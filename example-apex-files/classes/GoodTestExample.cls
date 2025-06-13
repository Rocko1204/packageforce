@isTest
public class GoodTestExample {
    
    @testSetup
    static void setup() {
        // Using test data factory for setup
        List<Account> accounts = TestDataFactory.createAccounts(5, true);
        List<Contact> contacts = TestDataFactory.createContactsForAccounts(accounts, 2, true);
    }
    
    @isTest
    static void testAccountCreation() {
        // GOOD: Using test data factory
        Account acc = TestDataFactory.createAccount('Test Account', false);
        acc.Industry = 'Technology';
        insert acc;
        
        // GOOD: Using builder pattern
        Contact con = new ContactBuilder()
            .withFirstName('John')
            .withLastName('Doe')
            .withAccount(acc.Id)
            .build();
        insert con;
        
        // Verify the results
        Account insertedAcc = [SELECT Id, Name, Industry FROM Account WHERE Id = :acc.Id];
        System.assertEquals('Test Account', insertedAcc.Name);
        System.assertEquals('Technology', insertedAcc.Industry);
        
        Contact insertedCon = [SELECT Id, FirstName, AccountId FROM Contact WHERE Id = :con.Id];
        System.assertEquals('John', insertedCon.FirstName);
        System.assertEquals(acc.Id, insertedCon.AccountId);
    }
    
    @isTest
    static void testBulkOperations() {
        // GOOD: Using factory for bulk operations
        List<Account> accounts = TestDataFactory.createAccounts(200, true);
        
        // GOOD: Bulk query instead of loop
        Map<Id, Account> accountMap = new Map<Id, Account>(
            [SELECT Id, Name FROM Account WHERE Id IN :accounts]
        );
        
        System.assertEquals(200, accountMap.size());
        
        // GOOD: Using factory for related records
        List<Contact> contacts = TestDataFactory.createContactsForAccounts(accounts, 2, true);
        System.assertEquals(400, contacts.size());
    }
    
    @isTest
    static void testWithProperAssertions() {
        // GOOD: Clear test data setup
        Account testAccount = TestDataFactory.createAccount('Test Account', true);
        
        // GOOD: Testing with proper assertions
        testAccount.Industry = 'Finance';
        update testAccount;
        
        Account updatedAccount = [SELECT Industry FROM Account WHERE Id = :testAccount.Id];
        System.assertEquals('Finance', updatedAccount.Industry, 'Industry should be updated to Finance');
    }
}