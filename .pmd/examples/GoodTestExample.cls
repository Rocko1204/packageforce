/**
 * Example of a well-written test class following best practices
 * This demonstrates proper use of test data factories and patterns
 */
@isTest
private class GoodTestExample {
    
    /**
     * Test setup method to create common test data
     * This runs once before all test methods
     */
    @testSetup
    static void setup() {
        // Create test accounts using factory
        List<Account> accounts = TestDataFactory.createAccounts(3, true);
        
        // Create related contacts using factory
        for (Account acc : accounts) {
            TestDataFactory.createContact(acc.Id, 'Test', 'Contact', true);
        }
    }
    
    @isTest
    static void testAccountCreationWithFactory() {
        // Using test data factory for single record
        Account acc = TestDataFactory.createAccount('Factory Test Account', false);
        acc.Industry = 'Healthcare';
        insert acc;
        
        // Using test data factory for related records
        Contact con = TestDataFactory.createContact(acc.Id, 'Jane', 'Smith', true);
        
        // Assertions
        System.assertEquals('Factory Test Account', acc.Name);
        System.assertEquals('Healthcare', acc.Industry);
        System.assertEquals(acc.Id, con.AccountId);
    }
    
    @isTest
    static void testAccountBuilderPattern() {
        // Using builder pattern for flexible test data creation
        Account acc = new AccountBuilder()
            .withName('Builder Test Account')
            .withType('Partner')
            .withIndustry('Finance')
            .withAnnualRevenue(1000000)
            .withBillingAddress('123 Main St', 'San Francisco', 'CA', '94105')
            .buildAndInsert();
        
        // Query to verify
        Account queriedAcc = [SELECT Id, Name, Type, Industry, AnnualRevenue 
                              FROM Account 
                              WHERE Id = :acc.Id];
        
        System.assertEquals('Builder Test Account', queriedAcc.Name);
        System.assertEquals('Partner', queriedAcc.Type);
        System.assertEquals('Finance', queriedAcc.Industry);
        System.assertEquals(1000000, queriedAcc.AnnualRevenue);
    }
    
    @isTest
    static void testBulkOperationsWithFactory() {
        // Using factory for bulk operations
        Test.startTest();
        List<Account> bulkAccounts = TestDataFactory.createAccounts(200, true);
        
        // Create contacts for each account using factory pattern
        List<Contact> contacts = new List<Contact>();
        for (Account acc : bulkAccounts) {
            contacts.add(TestDataFactory.createContact(acc.Id, 'Bulk', 'Contact', false));
        }
        insert contacts;
        Test.stopTest();
        
        // Verify bulk creation
        System.assertEquals(200, bulkAccounts.size());
        System.assertEquals(200, contacts.size());
        
        // Verify governor limits are respected
        System.assert(Limits.getQueries() < Limits.getLimitQueries());
        System.assert(Limits.getDmlStatements() < Limits.getLimitDmlStatements());
    }
    
    @isTest
    static void testComplexScenarioWithFactory() {
        // Retrieve test data created in @testSetup
        Account existingAccount = [SELECT Id, Name FROM Account LIMIT 1];
        
        // Create additional test data using factory
        Opportunity opp = TestDataFactory.createOpportunity(
            existingAccount.Id, 
            'Complex Test Opportunity', 
            'Qualification', 
            true
        );
        
        // Use builder pattern for complex setup
        Account parentAccount = new AccountBuilder()
            .withName('Parent Corporation')
            .withType('Enterprise')
            .buildAndInsert();
            
        Account childAccount = new AccountBuilder()
            .withName('Child Division')
            .withParentAccount(parentAccount.Id)
            .buildAndInsert();
        
        // Verify relationships
        Account queriedChild = [SELECT Id, ParentId, Parent.Name 
                                FROM Account 
                                WHERE Id = :childAccount.Id];
        
        System.assertEquals(parentAccount.Id, queriedChild.ParentId);
        System.assertEquals('Parent Corporation', queriedChild.Parent.Name);
    }
    
    @isTest
    static void testWithRunAs() {
        // Create test user using factory
        User testUser = TestDataFactory.createUser('Standard User', true);
        
        System.runAs(testUser) {
            // Create data as the test user
            Account acc = TestDataFactory.createAccount('User Test Account', true);
            
            // Verify ownership
            Account queriedAcc = [SELECT Id, OwnerId FROM Account WHERE Id = :acc.Id];
            System.assertEquals(testUser.Id, queriedAcc.OwnerId);
        }
    }
}