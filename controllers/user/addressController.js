const Address = require('../../models/addressSchema')
const User = require('../../models/userSchema')


const addAddress = async (req,res) =>{
    try {
        const {
            name,
            addressType,
            city,
            state,
            pincode,
            landMark,
            phone,
            altPhone
        } = req.body
        console.log("Req.body:",req.body)

        if (!name || !addressType || !city || !state || !pincode || !phone) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const validationErrors = [];

        // Name validation
        if (!name || name.trim().length < 2) {
            validationErrors.push('Name should be at least 2 characters long');
        } else if (!/^[a-zA-Z\s]{2,50}$/.test(name.trim())) {
            validationErrors.push('Name should contain only letters and spaces (2-50 characters)');
        }

        // Address Type validation
        if (!addressType || !['home', 'work', 'other'].includes(addressType.toLowerCase())) {
            validationErrors.push('Please select a valid address type');
        }

        // City validation
        if (!city || city.trim().length < 2) {
            validationErrors.push('City name should be at least 2 characters long');
        } else if (!/^[a-zA-Z\s]{2,50}$/.test(city.trim())) {
            validationErrors.push('City should contain only letters and spaces');
        }

        // State validation
        if (!state || state.trim().length < 2) {
            validationErrors.push('State name should be at least 2 characters long');
        } else if (!/^[a-zA-Z\s]{2,50}$/.test(state.trim())) {
            validationErrors.push('State should contain only letters and spaces');
        }

        // Pincode validation
        if (!pincode || !/^\d{6}$/.test(pincode)) {
            validationErrors.push('Please enter a valid 6-digit pincode');
        }

        // Phone validation
        if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
            validationErrors.push('Please enter a valid 10-digit phone number');
        }

        // Alternate phone validation (optional)
        if (altPhone && !/^[6-9]\d{9}$/.test(altPhone)) {
            validationErrors.push('Please enter a valid alternate phone number');
        }

        if (validationErrors.length > 0) {
            return res.status(400).json({ error: validationErrors.join(', ') });
        }

        const userId = req.session.user?._id;
        console.log("UserId:",userId) 

        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        let userAddress = await Address.findOne({userId})
        console.log("UserAddress:",userAddress)

        if (!userAddress) {
            userAddress = new Address({
                userId,
                address: [{
                    name: name.trim(),
                    addressType: addressType.toLowerCase(),
                    city: city.trim(),
                    state: state.trim(),
                    pincode,
                    landMark: landMark ? landMark.trim() : '',
                    phone,
                    altPhone: altPhone || ''
                }]
            });
        } else {
            // Check for duplicate address
            const existingAddress = userAddress.address.find(addr =>
                addr.addressType.toLowerCase() === addressType.toLowerCase() &&
                addr.city.toLowerCase() === city.toLowerCase() &&
                addr.pincode === pincode
            );

            if (existingAddress) {
                 return res.status(409).json({ error: 'This address already exists' });
            }
            userAddress.address.push({
                name: name.trim(),
                addressType: addressType.toLowerCase(),
                city: city.trim(),
                state: state.trim(),
                pincode,
                landMark: landMark ? landMark.trim() : '',
                phone,
                altPhone: altPhone || ''
            });
        }

        console.log("New address to be saved:", {
            name,
            addressType,
            city,
            state,
            pincode,
            landMark,       
            phone,
            altPhone
        });

        await userAddress.save()
        res.status(200).json({ message: 'Address added successfully' });

        //res.redirect("/addresses")  ////here is the error see you tomorrow

 
    } catch (error) {

        console.error("Error adding address:", error.message); 
        res.status(500).json({ error: 'An error occurred while adding the address' });
    }
}

const getAddresses = async (req, res) => {
    try {
        const userId = req.session.user?._id;

        // Fetch the user's addresses
        const userAddress = await Address.findOne({ userId });

        if (!userAddress) {
            return res.status(404).render("user/addresses", {
                addresses: [],
                user: req.session.user,
                userEmail: req.session.user?.email,
                error: 'No addresses found'
            });
        }

        // Render the addresses page with the fetched data
        res.render("user/addresses", {
            addresses: [userAddress], // Wrap in an array to match the EJS template
            user: req.session.user,
            userEmail: req.session.user?.email
        });

    } catch (error) {
        console.log('Error while loading address page:', error);
        res.status(500).render("user/addresses", {
            addresses: [],
            user: req.session.user,
            userEmail: req.session.user?.email,
            error: 'An error occurred while loading addresses'
        });
    }
};
const getEditAddress = async (req,res) =>{
    try {
        const address = await Address.findOne({ 'address._id': req.params.id });

        if (!address) {
            return res.status(404).json({ error: 'Address not found' });
        }

        const addressData = address.address.id(req.params.id);
        res.json(addressData);

    } catch (error) {
        res.status(500).json({ error: 'An error occurred while fetching the address', details: error.message });
    }

}

const editAddress = async (req,res) =>{
    try {
        const { id } = req.params; 
        const { name, addressType, city, landMark, state, pincode, phone, altPhone } = req.body;

        console.log('Request Params:', req.params);
        console.log('Request Body:', req.body);
        console.log('Authenticated user:', req.user);

        if (!req.user || !req.user._id) {
            return res.status(401).json({ error: 'User not authenticated or User ID is undefined' });
        }
        
        const validationErrors = [];

        // Name validation
        if (!name || name.trim().length < 2) {
            validationErrors.push('Name should be at least 2 characters long');
        } else if (!/^[a-zA-Z\s]{2,50}$/.test(name.trim())) {
            validationErrors.push('Name should contain only letters and spaces (2-50 characters)');
        }

        // Phone validation
        if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
            validationErrors.push('Please enter a valid 10-digit phone number');
        }

        // Pincode validation
        if (!pincode || !/^\d{6}$/.test(pincode)) {
            validationErrors.push('Please enter a valid 6-digit pincode');
        }

        // Alternate phone validation (optional)
        if (altPhone && !/^[6-9]\d{9}$/.test(altPhone)) {
            validationErrors.push('Please enter a valid alternate phone number');
        }

        if (validationErrors.length > 0) {
            return res.status(400).json({ error: validationErrors.join(', ') });
        }

        if (!req.session.user?._id) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const userAddress = await Address.findOne({ 'address._id': id });
        if (!userAddress) {
            return res.status(404).json({ error: 'Address not found' });
        }

        const addressToEdit = userAddress.address.id(id);
        if (!addressToEdit) {
            return res.status(404).json({ error: 'Address not found' });
        }

        // Check for duplicate address but exclude current address
        const duplicateAddress = userAddress.address.find(addr =>
            addr._id.toString() !== id &&
            addr.addressType.toLowerCase() === addressType.toLowerCase() &&
            addr.city.toLowerCase() === city.toLowerCase() &&
            addr.pincode === pincode
        );

        if (duplicateAddress) {
            return res.status(409).json({ error: 'An address with similar details already exists' });
        }

        // Update address fields
        addressToEdit.name = name.trim();
        addressToEdit.addressType = addressType.toLowerCase();
        addressToEdit.city = city.trim();
        addressToEdit.landMark = landMark ? landMark.trim() : '';
        addressToEdit.state = state.trim();
        addressToEdit.pincode = pincode;
        addressToEdit.phone = phone;
        addressToEdit.altPhone = altPhone || '';

        userAddress.markModified('address');

        await userAddress.save(); 

        console.log('Address updated successfully:', addressToEdit);
        
        return res.json({ message: 'Address updated successfully', address: addressToEdit});

    } catch (error) {
        console.error('Error updating address:', error);
        return res.status(500).json({ error: 'An error occurred while editing the address', details: error.message });
    }
};

const deleteAddress = async (req,res) =>{
    try {
        const { id } = req.params; 
        const userId = req.user._id; 

        console.log('User ID:', userId);
        console.log('Address ID:', id);

        if (!req.session.user?._id) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        
        const userAddress = await Address.findOne({ userId });
        if (!userAddress) {
            console.error('User address document not found');
            return res.status(404).json({ error: 'User address document not found' });
        }

        console.log('User Address Document:', userAddress);
        console.log('User Addresses:', userAddress.address);

        //  remove the address from the array by its ID
        userAddress.address = userAddress.address.filter(address => address._id.toString() !== id);
        
       
        await userAddress.save();
        
        console.log('Address deleted successfully');
        res.json({ message: 'Address deleted successfully', addresses: userAddress.address });

    } catch (error) {
        console.error('Error deleting address:', error);
        res.status(500).json({ error: 'An error occurred while deleting the address' });
    }
}


module.exports = {
addAddress,
getAddresses,
getEditAddress,
editAddress,
deleteAddress
}