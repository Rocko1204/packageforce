/**
 * Builder pattern implementation for Account test data
 * This class demonstrates the builder pattern for test data creation
 */
public class AccountBuilder {
    private Account account;
    
    /**
     * Constructor initializes account with default values
     */
    public AccountBuilder() {
        this.account = new Account(
            Type = 'Customer',
            Industry = 'Technology',
            BillingCountry = 'USA'
        );
    }
    
    /**
     * Sets the account name
     * @param name Account name
     * @return Builder instance for method chaining
     */
    public AccountBuilder withName(String name) {
        this.account.Name = name;
        return this;
    }
    
    /**
     * Sets the account type
     * @param type Account type
     * @return Builder instance for method chaining
     */
    public AccountBuilder withType(String type) {
        this.account.Type = type;
        return this;
    }
    
    /**
     * Sets the account industry
     * @param industry Account industry
     * @return Builder instance for method chaining
     */
    public AccountBuilder withIndustry(String industry) {
        this.account.Industry = industry;
        return this;
    }
    
    /**
     * Sets the annual revenue
     * @param revenue Annual revenue amount
     * @return Builder instance for method chaining
     */
    public AccountBuilder withAnnualRevenue(Decimal revenue) {
        this.account.AnnualRevenue = revenue;
        return this;
    }
    
    /**
     * Sets the number of employees
     * @param employees Number of employees
     * @return Builder instance for method chaining
     */
    public AccountBuilder withNumberOfEmployees(Integer employees) {
        this.account.NumberOfEmployees = employees;
        return this;
    }
    
    /**
     * Sets the billing address
     * @param street Street address
     * @param city City
     * @param state State/Province
     * @param postalCode Postal code
     * @return Builder instance for method chaining
     */
    public AccountBuilder withBillingAddress(String street, String city, String state, String postalCode) {
        this.account.BillingStreet = street;
        this.account.BillingCity = city;
        this.account.BillingState = state;
        this.account.BillingPostalCode = postalCode;
        return this;
    }
    
    /**
     * Sets the shipping address (copies billing if not set separately)
     * @param street Street address
     * @param city City
     * @param state State/Province
     * @param postalCode Postal code
     * @return Builder instance for method chaining
     */
    public AccountBuilder withShippingAddress(String street, String city, String state, String postalCode) {
        this.account.ShippingStreet = street;
        this.account.ShippingCity = city;
        this.account.ShippingState = state;
        this.account.ShippingPostalCode = postalCode;
        return this;
    }
    
    /**
     * Sets the parent account
     * @param parentId Parent account ID
     * @return Builder instance for method chaining
     */
    public AccountBuilder withParentAccount(Id parentId) {
        this.account.ParentId = parentId;
        return this;
    }
    
    /**
     * Sets the account owner
     * @param ownerId Owner user ID
     * @return Builder instance for method chaining
     */
    public AccountBuilder withOwner(Id ownerId) {
        this.account.OwnerId = ownerId;
        return this;
    }
    
    /**
     * Builds the account without inserting
     * @return The built Account record
     */
    public Account build() {
        // Copy billing to shipping if shipping not set
        if (String.isBlank(this.account.ShippingStreet) && !String.isBlank(this.account.BillingStreet)) {
            this.account.ShippingStreet = this.account.BillingStreet;
            this.account.ShippingCity = this.account.BillingCity;
            this.account.ShippingState = this.account.BillingState;
            this.account.ShippingPostalCode = this.account.BillingPostalCode;
            this.account.ShippingCountry = this.account.BillingCountry;
        }
        
        return this.account;
    }
    
    /**
     * Builds and inserts the account
     * @return The inserted Account record with ID
     */
    public Account buildAndInsert() {
        Account acc = this.build();
        insert acc;
        return acc;
    }
    
    /**
     * Creates multiple accounts with incremental names
     * @param baseName Base name for accounts
     * @param count Number of accounts to create
     * @return List of Account builders
     */
    public static List<AccountBuilder> createMultiple(String baseName, Integer count) {
        List<AccountBuilder> builders = new List<AccountBuilder>();
        
        for (Integer i = 0; i < count; i++) {
            builders.add(new AccountBuilder().withName(baseName + ' ' + i));
        }
        
        return builders;
    }
}