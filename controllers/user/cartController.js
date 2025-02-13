// const { Router } = require('express');
const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const User = require('../../models/userSchema');

const getCartPage = async (req, res) => {
    try {
        console.log("helooooo")
        const userId = req.session.user._id;

        let cart = await Cart.findOne({ userId }).populate({
            path: 'item.productId',
            select: 'productName  productImage', 
        });
        console.log("carttttt",cart)

        if (!cart) {
            return res.render('cart', { cart: [], cartTotal: 0 });
        }

        // Ensure cart and cart.item exist
        const formattedCart = cart && cart.item ? cart.item.map(item => {
            const productImage = Array.isArray(item.productId.productImage) 
                ? item.productId.productImage[0]  // If it's an array, take the first image
                : item.productId.productImage;

            return{
                productId: item.productId._id,
                productName: item.productId.productName,
                name: item.name,
                productImage: productImage,
                size: item.size,
                quantity: item.quantity,
                price: item.price,
                total: item.total
            }     
           
        }) : [];

        console.log("Formatted Cart:",formattedCart)

        const cartTotal = cart ? cart.cartTotal : 0;

        res.render("user/cart", { 
            cart: formattedCart, 
            cartTotal: cart.cartTotal 
        });
    } catch (error) {
        console.error("Error fetching cart:", error);
        res.status(500).send("Error fetching cart");
    }
};
const addToCart = async (req, res) => {
    try {
        console.log("Received Add to Cart request:", req.body);

        const { quantity, size } = req.body;
        const { id: productId } = req.params;
        const userId = req.session.user._id; // Ensure authentication middleware

        console.log("Product ID:", productId);
        console.log("Selected Size:", size);
        console.log("User ID:", userId);  

        if (!quantity || !size) {
            return res.status(400).json({ message: "Size and quantity are required." });
        }

        // Find the product
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        console.log("Here is the product:",product)

        // Find the selected size in product stock
        const selectedStock = product.stock.find(item => item.size === size);
        console.log("Selected Stock:",selectedStock);
        if (!selectedStock) {
            return res.status(400).json({ message: "Selected size is unavailable." });
        }

        if (selectedStock.quantity < quantity) {
            return res.status(400).json({ message: "Insufficient stock available." });
        }

        // Find or create the user's cart
        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({ userId, item: [], cartTotal: 0 });
        }
        console.log("Cart finded:",cart);

        // Check if the product already exists in the cart
        const existingItemIndex = cart.item.findIndex(
            item => item.productId.toString() === productId && item.size === size
        );

        console.log("Existing Item Index:",existingItemIndex)

        if (existingItemIndex > -1) {
            // Update quantity if product exists
            cart.item[existingItemIndex].quantity += parseInt(quantity);
            cart.item[existingItemIndex].total =
                cart.item[existingItemIndex].price * cart.item[existingItemIndex].quantity;
        } else {
            // Add new cart item
            cart.item.push({
                productId,
                name: product.productName,
                size,
                quantity: parseInt(quantity),
                price: product.salePrice,
                stock: selectedStock.quantity,
                total: product.salePrice * quantity
            });
        }

        // Update cart total
        cart.cartTotal = cart.item.reduce((sum, item) => sum + item.total, 0);

        // Save cart
        await cart.save();
        console.log("cart",cart)
        res.status(200).json({
            success: true,
            message: "Product added to cart successfully",
            cartItemCount: cart.item.length
        });

    } catch (error) {
        console.error("Add to Cart Error:", error);
        res.status(500).json({
            message: "Error adding product to cart",
            error: error.message
        });
    }
};

const deleteCartItem = async (req,res) =>{
    try {
        const {productId} = req.params
        const { size } = req.query;

        console.log("productId to be deleted:",productId)
        console.log("size to be deleted:", size);

        const userId = req.session.user._id;
        console.log("Now the userID:",userId)

        if (!req.session.user || !req.session.user._id) {
            return res.status(401).json({ message: 'User not authenticated', redirect: "/login" });
        }

        const cart = await Cart.findOne({userId})
        console.log("Cart to be deleted:",cart);

        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        const itemToRemove = cart.item.find(item => item.productId.toString() === productId && item.size === size);
        if(!itemToRemove){
            return res.status(404).json({ message: 'Item not found in cart' })
        }

        // Calculate the amount to subtract from cart total
        const amountToSubtract = itemToRemove.price * itemToRemove.quantity;

        // Remove the item and update cart total
        cart.item = cart.item.filter(item => !( item.productId.toString() === productId && item.size === size));
        cart.cartTotal -= amountToSubtract;

        // Save the updated cart
        await cart.save();

        res.status(200).json({ success: true,message: 'Item removed successfully',cart: cart});

    } catch (error) {
        console.error('Error in deleteCartItem:', error);
        res.status(500).json({ message: 'Internal server error',error: error.message});
    }
}



const updateCart = async (req, res) => {
    const { productId, action } = req.body;
    const userId = req.session?.user?._id;
    const MAX_QUANTITY = 10; // Match frontend limit
    
    console.log("Received request:", { userId, productId, action });
  
    if (!userId) {
        return res.status(400).json({ message: "User not authenticated" });
    }
  
    if (!productId || !action) {
        return res.status(400).json({ message: "Invalid request data" });
    }
  
    const update = action === "increment" ? 1 : -1;
  
    try {
        const cart = await Cart.findOne({ userId });
  
        if (!cart) {
            return res.status(400).json({ message: "Cart not found" });
        }
  
        const itemIndex = cart.item.findIndex(item => item.productId.toString() === productId);
  
        if (itemIndex === -1) {
            return res.status(400).json({ message: "Item not found in cart" });
        }
  
        let item = cart.item[itemIndex];
        const product = await Product.findById(item.productId);
  
        if (!product) {
            return res.status(400).json({ message: "Product not found" });
        }
  
        const selectedStock = product.stock.find(stockItem => stockItem.size === item.size);
  
        if (!selectedStock) {
            return res.status(400).json({ message: "Stock not available for the selected size" });
        }
  
        const newQuantity = item.quantity + update;
  
        // Check minimum quantity
        if (newQuantity < 1) {
            return res.status(400).json({ message: "Quantity cannot be less than 1" });
        }
  
        // Check maximum quantity (both stock and MAX_QUANTITY limit)
        if (newQuantity > MAX_QUANTITY) {
            return res.status(400).json({ message: `Maximum quantity allowed is ${MAX_QUANTITY} items` });
        }
  
        if (newQuantity > selectedStock.quantity) {
            return res.status(400).json({ message: `Only ${selectedStock.quantity} items in stock` });
        }
  
        // Update cart item
        cart.item[itemIndex].quantity = newQuantity;
        cart.item[itemIndex].total = newQuantity * item.price;
        
        // Update cart total
        cart.cartTotal = cart.item.reduce((sum, cartItem) => sum + cartItem.total, 0);
  
        await cart.save();
  
        res.json({
            success: true,
            newQuantity: cart.item[itemIndex].quantity,
            newTotal: cart.item[itemIndex].total,
            cartTotal: cart.cartTotal
        });
  
    } catch (error) {
        console.error("Error while updating cart:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}
  
// const cartCount = async (req, res) => {
//     try {
//         const userId = req.session.user?.id;
        
//         // Add validation for userId
//         if (!userId) {
//             return res.status(401).json({ error: 'User not authenticated' });
//         }
  
//         const cart = await Cart.findOne({ userId: userId }); 
//         const count = cart ? cart.items.length : 0;
//         res.json({ count });
//     } catch (error) {
//         console.error('Error fetching cart count:', error);
//         res.status(500).json({ error: 'Internal server error' });
//     }
//   };
  




module.exports = {
    getCartPage,
    addToCart,
    deleteCartItem,
    updateCart,
}