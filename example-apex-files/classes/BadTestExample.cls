@isTest
public class BadTestExample {
    
    @isTest
    static void testAccountCreation() {
        // VIOLATION: Direct instantiation of Account
        Account acc = new Account();
        acc.Name = 'Test Account';
        acc.Industry = 'Technology';
        insert acc;
        
        // VIOLATION: Direct instantiation of Contact
        Contact con = new Contact();
        con.FirstName = 'John';
        con.LastName = 'Doe';
        con.AccountId = acc.Id;
        insert con;
        
        // VIOLATION: Direct instantiation of custom object
        Opportunity__c opp = new Opportunity__c();
        opp.Name = 'Test Opportunity';
        opp.Account__c = acc.Id;
        insert opp;
        
        System.assert(acc.Id != null);
    }
    
    @isTest
    static void testMultipleRecords() {
        List<Account> accounts = new List<Account>();
        
        // VIOLATION: Creating records in a loop
        for (Integer i = 0; i < 5; i++) {
            Account acc = new Account();
            acc.Name = 'Test Account ' + i;
            accounts.add(acc);
        }
        
        insert accounts;
        
        // VIOLATION: SOQL in a loop
        for (Account acc : accounts) {
            List<Contact> contacts = [SELECT Id FROM Contact WHERE AccountId = :acc.Id];
            System.assert(contacts.isEmpty());
        }
    }
    
    @isTest
    static void testWithoutAssertions() {
        // VIOLATION: Test without assertions
        Account acc = new Account();
        acc.Name = 'Test';
        insert acc;
    }
}