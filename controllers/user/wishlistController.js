const mongoose = require("mongoose");
const Wishlist = require("../../models/wishlistSchema");
const Product = require("../../models/productSchema");
const User = require("../../models/userSchema");
const path = require("path");

const addToWishlist = async (req,res) =>{
    try {
        const { productId, selectedSize } = req.body;
        const userId = req.session.user._id; // Assuming you store user_id in session

        let wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            // Create new wishlist if doesn't exist
            wishlist = new Wishlist({
                userId,
                items: [{ productId, selectedSize }]
            });
        } else {
            // Check if product already exists
            const existingItem = wishlist.items.find(
                item => item.productId.toString() === productId && item.selectedSize === selectedSize
            );

            if (existingItem) {
                return res.status(400).json({
                    success: false,
                    message: 'Item already in wishlist'
                });
            }

            // Add new item
            wishlist.items.push({ productId, selectedSize });
        }

        await wishlist.save();
        res.json({
            success: true,
            message: 'Added to wishlist successfully'
        });

    } catch (error) {
        console.error('Wishlist addition error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add to wishlist'
        });
    }
}

const removeFromWishlist = async (req,res) =>{
    try {
        const { productId, selectedSize } = req.body;
        const userId = req.session.user._id;
        const wishlist = await Wishlist.findOne({ userId });
        console.log("wishlist:",wishlist);
        if (!wishlist) {
            return res.status(404).json({
                success: false,
                message: 'Wishlist not found'
            });
        }

        wishlist.items = wishlist.items.filter(
            item => !(item.productId.toString() === productId && item.selectedSize === selectedSize)
        );

        await wishlist.save();
        res.json({
            success: true,
            message: 'Removed from wishlist successfully'
        });

    } catch (error) {
        console.error('Wishlist removal error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to remove from wishlist'
        });
    }
}

const getWishlist = async (req,res) =>{
    try {
        // Fetch wishlist with populated product details
        const wishlistItems = await Wishlist.findOne({ userId: req.session.user._id })
          .populate({
            path: 'items.productId',
            select: 'productName productImage salePrice' // Select only needed fields
          });
    
        // If no wishlist exists, create an empty one
        if (!wishlistItems) {
          return res.render('wishlist', { wishlistItems: { items: [] } });
        }
        // res.status(200).json({success: true,message:})
    
        res.render('user/wishlist', { wishlistItems });
      } catch (error) {
        console.error('Error fetching wishlist:', error);
        res.status(500).render('error', { message: 'Failed to load wishlist' });
      }
    }

    




module.exports ={
    addToWishlist,
    removeFromWishlist,
    getWishlist,
    //checkWishlistStatus
}







//! friends <<<<<<<<<<<<<<<<<<<<<<<<<<<<<< baby
