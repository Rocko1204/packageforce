/**
 * Test Data Factory for creating test records
 * This class demonstrates the proper patterns for test data creation
 */
public class TestDataFactory {
    
    /**
     * Creates a test Account record
     * @param name The account name
     * @param doInsert Whether to insert the record
     * @return The created Account record
     */
    public static Account createAccount(String name, Boolean doInsert) {
        Account acc = new Account(
            Name = name,
            Type = 'Customer',
            Industry = 'Technology',
            BillingStreet = '123 Test St',
            BillingCity = 'Test City',
            BillingState = 'CA',
            BillingPostalCode = '12345',
            BillingCountry = 'USA'
        );
        
        if (doInsert) {
            insert acc;
        }
        
        return acc;
    }
    
    /**
     * Creates multiple test Account records
     * @param count Number of accounts to create
     * @param doInsert Whether to insert the records
     * @return List of created Account records
     */
    public static List<Account> createAccounts(Integer count, Boolean doInsert) {
        List<Account> accounts = new List<Account>();
        
        for (Integer i = 0; i < count; i++) {
            accounts.add(new Account(
                Name = 'Test Account ' + i,
                Type = 'Customer',
                Industry = 'Technology'
            ));
        }
        
        if (doInsert) {
            insert accounts;
        }
        
        return accounts;
    }
    
    /**
     * Creates a test Contact record
     * @param accountId The parent account ID
     * @param firstName Contact first name
     * @param lastName Contact last name
     * @param doInsert Whether to insert the record
     * @return The created Contact record
     */
    public static Contact createContact(Id accountId, String firstName, String lastName, Boolean doInsert) {
        Contact con = new Contact(
            FirstName = firstName,
            LastName = lastName,
            AccountId = accountId,
            Email = firstName.toLowerCase() + '.' + lastName.toLowerCase() + '@test.example.com',
            Phone = '555-0100'
        );
        
        if (doInsert) {
            insert con;
        }
        
        return con;
    }
    
    /**
     * Creates an Account with related Contacts
     * @param accountName The account name
     * @param contactCount Number of contacts to create
     * @param doInsert Whether to insert the records
     * @return Map containing the account and contacts
     */
    public static Map<String, Object> createAccountWithContacts(String accountName, Integer contactCount, Boolean doInsert) {
        Account acc = createAccount(accountName, doInsert);
        
        List<Contact> contacts = new List<Contact>();
        for (Integer i = 0; i < contactCount; i++) {
            contacts.add(new Contact(
                FirstName = 'Test',
                LastName = 'Contact ' + i,
                AccountId = acc.Id,
                Email = 'test.contact' + i + '@example.com'
            ));
        }
        
        if (doInsert && !contacts.isEmpty()) {
            insert contacts;
        }
        
        return new Map<String, Object>{
            'account' => acc,
            'contacts' => contacts
        };
    }
    
    /**
     * Creates a test Opportunity record
     * @param accountId The parent account ID
     * @param name Opportunity name
     * @param stage Opportunity stage
     * @param doInsert Whether to insert the record
     * @return The created Opportunity record
     */
    public static Opportunity createOpportunity(Id accountId, String name, String stage, Boolean doInsert) {
        Opportunity opp = new Opportunity(
            Name = name,
            AccountId = accountId,
            StageName = stage,
            CloseDate = Date.today().addDays(30),
            Amount = 10000
        );
        
        if (doInsert) {
            insert opp;
        }
        
        return opp;
    }
    
    /**
     * Creates test User record
     * @param profileName Name of the profile
     * @param doInsert Whether to insert the record
     * @return The created User record
     */
    public static User createUser(String profileName, Boolean doInsert) {
        Profile p = [SELECT Id FROM Profile WHERE Name = :profileName LIMIT 1];
        
        String uniqueName = 'testuser' + DateTime.now().getTime() + '@example.com';
        User u = new User(
            ProfileId = p.Id,
            FirstName = 'Test',
            LastName = 'User',
            Email = uniqueName,
            Username = uniqueName,
            CompanyName = 'Test Company',
            Title = 'Test Title',
            Alias = 'tuser',
            TimeZoneSidKey = 'America/Los_Angeles',
            EmailEncodingKey = 'UTF-8',
            LanguageLocaleKey = 'en_US',
            LocaleSidKey = 'en_US'
        );
        
        if (doInsert) {
            insert u;
        }
        
        return u;
    }
}