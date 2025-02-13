const Cart = require('../../models/cartSchema');
const Address = require('../../models/addressSchema');
const User = require("../../models/userSchema")


const getCheckoutPage = async (req, res) => {
    try {
        const userId = req.session.user._id; 

        // Fetch the user's addresses and find the default one
        const userAddress = await Address.findOne({ userId });

        let defaultAddress = null;
        if (userAddress && userAddress.address.length > 0) {
            defaultAddress = userAddress.address.find(addr => addr.isDefault === true) || userAddress.address[0];
        }

        // Fetch the user's cart details
        const userCart = await Cart.findOne({ userId });

        let cartItems = [];
        let subtotal = 0;
        let totalAmount = 0;
        const deliveryFee = 100;
       

        if (userCart && userCart.item.length > 0) {
            cartItems = userCart.item;
            subtotal = userCart.cartTotal;
            
            // Example: Apply a discount of 20% (Modify based on your logic)
           

            // Calculate total amount (Subtotal - Discount + Delivery Fee)
            totalAmount = subtotal + deliveryFee;
        }

        res.render("user/checkout", { 
            defaultAddress,
            cartItems,
            subtotal,       
            deliveryFee,
            totalAmount
        });

    } catch (error) {
        console.error("Error fetching checkout page:", error);
        res.status(500).send("Internal Server Error");
    }
};




module.exports ={
    getCheckoutPage,

}