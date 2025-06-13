/**
 * Example of a test class with PMD violations
 * This demonstrates what NOT to do in test classes
 */
@isTest
private class BadTestExample {
    
    // VIOLATION: No @testSetup method despite multiple test methods
    
    @isTest
    static void testAccountCreation() {
        // VIOLATION: Direct record instantiation instead of using factory
        Account acc = new Account();
        acc.Name = 'Test Account';
        acc.Type = 'Customer';
        insert acc;
        
        // VIOLATION: Direct record instantiation
        Contact con = new Contact();
        con.FirstName = 'John';
        con.LastName = 'Doe';
        con.AccountId = acc.Id;
        insert con;
        
        // VIOLATION: Direct custom object instantiation
        Custom_Object__c customObj = new Custom_Object__c();
        customObj.Name = 'Test Custom';
        customObj.Account__c = acc.Id;
        insert customObj;
        
        System.assertEquals('Test Account', acc.Name);
    }
    
    @isTest
    static void testContactCreation() {
        // VIOLATION: Repeating test data setup
        Account acc = new Account();
        acc.Name = 'Another Test Account';
        insert acc;
        
        // VIOLATION: Direct record instantiation
        List<Contact> contacts = new List<Contact>();
        for (Integer i = 0; i < 5; i++) {
            Contact c = new Contact();
            c.FirstName = 'Test';
            c.LastName = 'Contact ' + i;
            c.AccountId = acc.Id;
            contacts.add(c);
        }
        insert contacts;
        
        System.assertEquals(5, contacts.size());
    }
    
    @isTest
    static void testOpportunityCreation() {
        // VIOLATION: More repeated test data setup
        Account acc = new Account();
        acc.Name = 'Opportunity Test Account';
        insert acc;
        
        // VIOLATION: Direct record instantiation
        Opportunity opp = new Opportunity();
        opp.Name = 'Test Opportunity';
        opp.AccountId = acc.Id;
        opp.StageName = 'Prospecting';
        opp.CloseDate = Date.today().addDays(30);
        insert opp;
        
        System.assertNotEquals(null, opp.Id);
    }
    
    @isTest
    static void testBulkOperations() {
        // VIOLATION: Direct bulk record creation without factory
        List<Account> accounts = new List<Account>();
        for (Integer i = 0; i < 200; i++) {
            Account a = new Account();
            a.Name = 'Bulk Account ' + i;
            a.Type = 'Customer';
            accounts.add(a);
        }
        insert accounts;
        
        // VIOLATION: Direct record instantiation in loop
        List<Contact> contacts = new List<Contact>();
        for (Account a : accounts) {
            Contact c = new Contact();
            c.FirstName = 'Bulk';
            c.LastName = 'Contact';
            c.AccountId = a.Id;
            contacts.add(c);
        }
        insert contacts;
        
        System.assertEquals(200, accounts.size());
    }
}