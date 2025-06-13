/**
 * Builder pattern for creating test contacts with fluent interface
 */
@isTest
public class ContactBuilder {
    
    private Contact contact;
    
    public ContactBuilder() {
        // Initialize with default values
        this.contact = new Contact(
            FirstName = 'Test',
            LastName = 'Contact',
            Email = 'test.contact@example.com'
        );
    }
    
    public ContactBuilder withFirstName(String firstName) {
        this.contact.FirstName = firstName;
        return this;
    }
    
    public ContactBuilder withLastName(String lastName) {
        this.contact.LastName = lastName;
        return this;
    }
    
    public ContactBuilder withEmail(String email) {
        this.contact.Email = email;
        return this;
    }
    
    public ContactBuilder withPhone(String phone) {
        this.contact.Phone = phone;
        return this;
    }
    
    public ContactBuilder withAccount(Id accountId) {
        this.contact.AccountId = accountId;
        return this;
    }
    
    public ContactBuilder withTitle(String title) {
        this.contact.Title = title;
        return this;
    }
    
    public ContactBuilder withDepartment(String department) {
        this.contact.Department = department;
        return this;
    }
    
    public ContactBuilder withMailingAddress(String street, String city, String state, String postalCode, String country) {
        this.contact.MailingStreet = street;
        this.contact.MailingCity = city;
        this.contact.MailingState = state;
        this.contact.MailingPostalCode = postalCode;
        this.contact.MailingCountry = country;
        return this;
    }
    
    public ContactBuilder withBirthdate(Date birthdate) {
        this.contact.Birthdate = birthdate;
        return this;
    }
    
    /**
     * Builds and returns the contact without inserting
     */
    public Contact build() {
        return this.contact;
    }
    
    /**
     * Builds, inserts and returns the contact
     */
    public Contact buildAndInsert() {
        insert this.contact;
        return this.contact;
    }
    
    /**
     * Creates multiple contacts with the same configuration
     */
    public List<Contact> buildMultiple(Integer count) {
        List<Contact> contacts = new List<Contact>();
        
        for (Integer i = 0; i < count; i++) {
            Contact c = this.contact.clone(false, true, false, false);
            c.FirstName = this.contact.FirstName + i;
            c.Email = this.contact.FirstName.toLowerCase() + i + '@example.com';
            contacts.add(c);
        }
        
        return contacts;
    }
    
    /**
     * Creates and inserts multiple contacts
     */
    public List<Contact> buildAndInsertMultiple(Integer count) {
        List<Contact> contacts = buildMultiple(count);
        insert contacts;
        return contacts;
    }
}