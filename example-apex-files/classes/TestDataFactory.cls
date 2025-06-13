@isTest
public class TestDataFactory {
    
    /**
     * Creates test accounts
     * @param numberOfAccounts Number of accounts to create
     * @param doInsert Whether to insert the records
     * @return List of created accounts
     */
    public static List<Account> createAccounts(Integer numberOfAccounts, Boolean doInsert) {
        List<Account> accounts = new List<Account>();
        
        for (Integer i = 0; i < numberOfAccounts; i++) {
            accounts.add(createAccount('Test Account ' + i, false));
        }
        
        if (doInsert) {
            insert accounts;
        }
        
        return accounts;
    }
    
    /**
     * Creates a single test account
     * @param name Account name
     * @param doInsert Whether to insert the record
     * @return Created account
     */
    public static Account createAccount(String name, Boolean doInsert) {
        Account acc = new Account(
            Name = name,
            Industry = 'Technology',
            Type = 'Customer',
            BillingStreet = '123 Main St',
            BillingCity = 'San Francisco',
            BillingState = 'CA',
            BillingPostalCode = '94105',
            BillingCountry = 'USA'
        );
        
        if (doInsert) {
            insert acc;
        }
        
        return acc;
    }
    
    /**
     * Creates test contacts for given accounts
     * @param accounts List of accounts
     * @param contactsPerAccount Number of contacts per account
     * @param doInsert Whether to insert the records
     * @return List of created contacts
     */
    public static List<Contact> createContactsForAccounts(List<Account> accounts, Integer contactsPerAccount, Boolean doInsert) {
        List<Contact> contacts = new List<Contact>();
        
        for (Account acc : accounts) {
            for (Integer i = 0; i < contactsPerAccount; i++) {
                contacts.add(createContact(acc.Id, 'First' + i, 'Last' + i, false));
            }
        }
        
        if (doInsert) {
            insert contacts;
        }
        
        return contacts;
    }
    
    /**
     * Creates a single test contact
     * @param accountId Related account ID
     * @param firstName Contact first name
     * @param lastName Contact last name
     * @param doInsert Whether to insert the record
     * @return Created contact
     */
    public static Contact createContact(Id accountId, String firstName, String lastName, Boolean doInsert) {
        Contact con = new Contact(
            AccountId = accountId,
            FirstName = firstName,
            LastName = lastName,
            Email = firstName.toLowerCase() + '.' + lastName.toLowerCase() + '@example.com',
            Phone = '555-0100'
        );
        
        if (doInsert) {
            insert con;
        }
        
        return con;
    }
    
    /**
     * Creates test opportunities
     * @param accounts List of accounts
     * @param oppsPerAccount Number of opportunities per account
     * @param doInsert Whether to insert the records
     * @return List of created opportunities
     */
    public static List<Opportunity> createOpportunities(List<Account> accounts, Integer oppsPerAccount, Boolean doInsert) {
        List<Opportunity> opportunities = new List<Opportunity>();
        
        for (Account acc : accounts) {
            for (Integer i = 0; i < oppsPerAccount; i++) {
                Opportunity opp = new Opportunity(
                    AccountId = acc.Id,
                    Name = acc.Name + ' - Opportunity ' + i,
                    StageName = 'Prospecting',
                    CloseDate = Date.today().addDays(30),
                    Amount = Math.round(Math.random() * 100000)
                );
                opportunities.add(opp);
            }
        }
        
        if (doInsert) {
            insert opportunities;
        }
        
        return opportunities;
    }
}