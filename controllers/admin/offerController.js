const Offer = require('../../models/offerSchema')
const Product = require('../../models/productSchema')
const Category = require('../../models/categorySchema')

const getOfferPage = async (req, res) => {
    try {
        // Fetch active products and categories
        const products = await Product.find({ isBlocked: false });
        const categories = await Category.find({ isDeleted: false, isBlocked: false });
        
        // Fetch all offers with populated references
        const offers = await Offer.find()
            .populate('productId')
            .populate('categoryId');
        
        // Filter out offers with invalid references
        const validOffers = offers.filter(offer => {
            if (offer.offerType === 'product' && !offer.productId) return false;
            if (offer.offerType === 'category' && !offer.categoryId) return false;
            return true;
        });
        
        console.log('products', products);
        console.log('offers', validOffers);
        
        res.render('admin/offerPage', {
            admin: req.session.admin,
            active: 'offers',
            message: null,
            offers: validOffers,
            products: products,
            categories: categories
        });
    } catch (error) {
        console.log('error while loading offer', error);
        res.render('admin/offerPage', {
            admin: req.session.admin,
            active: 'offers',
            message: { text: 'Error loading offers', type: 'error' },
            offers: [],
            products: [],
            categories: []
        });
    }
};

const getAddOfferPage = async (req, res) => {
    try {
     
        const products = await Product.find({ isBlocked: false });
        const categories = await Category.find({ isBlocked: false, isDeleted: false });


        res.render('admin/addOfferPage', {
            products,
            categories
        });
    } catch (error) {
        console.error('Error while loading add offer page:', error);
        res.status(500).render('error', { 
            message: 'Failed to load add offer page',
            error
        });
    }
};

const addOffer = async (req, res) => {
    try {
        const { offerName, offerType, discount, startDate, endDate, productId, categoryId, referralCode, maxRedemptions } = req.body;

        const offers = await Offer.find().populate('productId').populate('categoryId');
        const products = await Product.find({ isBlocked: false });
        const categories = await Category.find({ isBlocked: false, isDeleted: false });

       
        if (!offerName || !offerType || !discount || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        const existingOfferWithName = await Offer.findOne({ 
            offerName: { $regex: new RegExp('^' + offerName + '$', 'i') } 
        });
        if (existingOfferWithName) {
            return res.status(400).json({
                success: false,
                message: 'An offer with this name already exists'
            });
        }

  
        if (discount < 0 || discount > 100) {
            return res.status(400).json({
                success: false,
                message: 'Discount must be between 0 and 100'
            });
        }

        
        const start = new Date(startDate);
        const end = new Date(endDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (start < today) {
            return res.status(400).json({
                success: false,
                message: 'Start date cannot be in the past'
            });
        }
        
        if (end <= start) {
            return res.status(400).json({
                success: false,
                message: 'End date must be after start date'
            });
        }

       
        let offerData = {
            offerName,
            offerType,
            discount: Number(discount),
            startDate,
            endDate,
            status: true,
            redeemCount: 0
        };


        if (maxRedemptions && Number(maxRedemptions) > 0) {
            offerData.maxRedemptions = Number(maxRedemptions);
        }

        let discountApplied = false;
        
        // For product-type offers
        if (offerType === "product") {
            if (!productId || productId.trim() === "") {
                return res.status(400).json({
                    success: false,
                    message: 'Product ID is required for product-type offers'
                });
            }
            
            const productExists = await Product.findById(productId);
            if (!productExists) {
                return res.status(400).json({
                    success: false,
                    message: 'Selected product does not exist'
                });
            }
            
            if (productExists.isBlocked) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot create offer for a blocked product'
                });
            }

            const existingProductOffer = await Offer.findOne({
                offerType: 'product',
                productId: productId,
                status: true,
                endDate: { $gt: new Date() }
            });
            
            if (existingProductOffer) {
                return res.status(400).json({
                    success: false,
                    message: 'This product already has an active offer'
                });
            }
            
            offerData.productId = productId;
            
            // Apply discount to the product - FIXED CALCULATION
            const originalPrice = productExists.salePrice;
            const discountAmount = (originalPrice * Number(discount)) / 100;
            const newSalePrice = originalPrice - discountAmount; // This is correct - we subtract the discount
            console.log("NEW",newSalePrice)
            
            // Update the product's sale price with the discounted price
            await Product.findByIdAndUpdate(productId, {
                salePrice: Math.round(newSalePrice * 100) / 100 // Round to 2 decimal places
            });
            
            discountApplied = true;
        }

        // For category-type offers
        if (offerType === "category") {
            if (!categoryId || categoryId.trim() === "") {
                return res.status(400).json({
                    success: false,
                    message: 'Category ID is required for category-type offers'
                });
            }
            
            const categoryExists = await Category.findById(categoryId);
            if (!categoryExists) {
                return res.status(400).json({
                    success: false,
                    message: 'Selected category does not exist'
                });
            }
            
            if (categoryExists.isBlocked || categoryExists.isDeleted) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot create offer for a blocked or deleted category'
                });
            }

            const existingCategoryOffer = await Offer.findOne({
                offerType: 'category',
                categoryId: categoryId,
                status: true,
                endDate: { $gt: new Date() }
            });
            
            if (existingCategoryOffer) {
                return res.status(400).json({
                    success: false,
                    message: 'This category already has an active offer'
                });
            }
            
            offerData.categoryId = categoryId;
            
            // Update the category with the offer percentage
            await Category.findByIdAndUpdate(categoryId, {
                categoryOffer: Number(discount)
            });
            
            // Apply discount to all products in this category
            const categoryProducts = await Product.find({ 
                category: categoryId,
                isBlocked: false
            });
            
            // Apply discount to all products in the category - FIXED CALCULATION
            for (const product of categoryProducts) {
                const originalPrice = product.salePrice;
                const discountAmount = (originalPrice * Number(discount)) / 100;
                const newSalePrice = originalPrice - discountAmount; // Subtract the discount amount
                
                await Product.findByIdAndUpdate(product._id, {
                    salePrice: Math.round(newSalePrice * 100) / 100 // Round to 2 decimal places
                });
            }
            
            discountApplied = true;
        }

        // For referral-type offers
        if (offerType === "referral") {
            if (!referralCode || referralCode.trim() === "") {
                return res.status(400).json({
                    success: false,
                    message: 'Referral Code is required for referral-type offers'
                });
            }
            
            const formattedReferralCode = referralCode.trim().toUpperCase();
            
            const existingOffer = await Offer.findOne({ referralCode: formattedReferralCode });
            if (existingOffer) {
                return res.status(400).json({
                    success: false,
                    message: 'This referral code is already in use'
                });
            }
            
            offerData.referralCode = formattedReferralCode;
        }

        // Create and save the new offer
        const newOffer = new Offer(offerData);
        await newOffer.save();

        // Add debugging information in development
        console.log('Offer applied:', {
            offerType,
            discount,
            affectedId: offerType === 'product' ? productId : offerType === 'category' ? categoryId : null,
            discountApplied
        });

        return res.status(200).json({
            success: true,
            message: `Offer added successfully${discountApplied ? ' and discount applied' : ''}`,
            offer: newOffer
        });

    } catch (error) {
        console.error('Error while adding offer:', error);
        
        if (error.name === 'ValidationError') {
            const errorMessage = Object.values(error.errors).map(err => err.message).join(', ');
            return res.status(400).json({
                success: false,
                message: errorMessage
            });
        }
        
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'This referral code is already in use'
            });
        }
        
        return res.status(500).json({
            success: false,
            message: `Server error: ${error.message}`
        });
    }
};

const deleteOffer = async (req, res) => {
    try {
        console.log('Entered deleting');
        const { offerId } = req.body;
        
        const offer = await Offer.findById(offerId)
        if (!offer) {
            return res.json({ success: false, message: "Offer not found" });
        }
       
        
        if (offer.offerType === 'product') {
           
            const product = await Product.findById(offer.productId);
            if (product) {
                await Product.findByIdAndUpdate(
                    offer.productId,
                    {
                        $unset: {
                            productOfferId: 1, 
                            productDiscount: 1, 
                        },
                        $set: { salePrice: product.regularPrice } 
                    },
                    { new: true }
                );
            }
        } else if (offer.offerType === 'category') {
            
            const catProducts = await Product.find({ category: offer.categoryId });
            for (const product of catProducts) {
                await Product.findByIdAndUpdate(
                    product._id,
                    {
                        $unset: {
                            categoryOfferId: 1, 
                            categoryDiscount: 1, 
                        },
                        $set: { salePrice: product.regularPrice }
                    },
                    { new: true }
                );
            }
        }
        
        // Use deleteOne instead of findByIdAndDelete for consistency with your code
        await Offer.deleteOne({ _id: offerId });
        res.json({ success: true, message: "Offer deleted successfully" });
    } catch (error) {
        console.log('Error in deleting the offer:', error);
        res.json({ success: false, message: "Error deleting offer: " + error.message });
    }
};


// const editCategoryOffer = async (req, res) => {
//     try {
//         const product = await Product.find({ isBlocked: false });
//         const categories = await Category.find({ isDeleted: false });
//         const offers = await Offer.find();
//         const categoryId = req.params.id;
        
//         const { discount, startDate, endDate } = req.body;
//         console.log('CategoryId', categoryId);
//         console.log('Request Body', req.body);
        
        
//         const existingOffer = await Offer.findOne({ 
//             offerType: 'category', 
//             categoryId: categoryId 
//         });
        
//         let updatedOffer;
        
//         if (existingOffer) {
            
//             updatedOffer = await Offer.findOneAndUpdate(
//                 { offerType: 'category', categoryId: categoryId },
//                 { 
//                     $set: {
//                         discount: discount,
//                         startDate: new Date(startDate),
//                         endDate: new Date(endDate),
//                         status: true 
//                     }
//                 },
//                 { new: true }
//             );
            
//             console.log('Updated existing category offer:', updatedOffer);
//         } else {
           
//             const newOffer = new Offer({
//                 offerType: 'category',
//                 categoryId: categoryId,
//                 discount: discount,
//                 startDate: new Date(startDate),
//                 endDate: new Date(endDate),
//                 status: true
//             });
            
//             updatedOffer = await newOffer.save();
//             console.log('Created new category offer:', updatedOffer);
//         }
        
        
//         await Category.findByIdAndUpdate(
//             categoryId,
//             { $set: { categoryOffer: discount } },
//             { new: true }
//         );
        
        
//         const updatedOffers = await Offer.find();
        
//         return res.render('admin/offerPage', {
//             message: { text: 'Category offer updated successfully', type: 'success' },
//             admin: req.session.admin,
//             active: 'offers',
//             offers: updatedOffers,
//             products: product,
//             categories
//         });
//     } catch (error) {
//         console.log('Error while editing category offer:', error);
        
//         return res.render('admin/offerPage', {
//             message: { text: 'Failed to update category offer', type: 'error' },
//             admin: req.session.admin,
//             active: 'offers',
//             offers: await Offer.find(),
//             products: await Product.find({ isBlocked: false }),
//             categories: await Category.find({ isDeleted: false })
//         })
//     }
// }

// const editProductOffer = async (req, res) => {
//     try {
//         const product = await Product.find({ isBlocked: false });
//         const categories = await Category.find({ isDeleted: false });
//         const offers = await Offer.find();
//         const productId = req.params.id;
        
//         const { discount, startDate, endDate } = req.body;
//         console.log('ProductId', productId);
//         console.log('Request Body', req.body);
        
        
//         const existingOffer = await Offer.findOne({ 
//             offerType: 'product', 
//             productId: productId 
//         });
        
//         let updatedOffer;
        
//         if (existingOffer) {
           
//             updatedOffer = await Offer.findOneAndUpdate(
//                 { offerType: 'product', productId: productId },
//                 { 
//                     $set: {
//                         discount: discount,
//                         startDate: new Date(startDate),
//                         endDate: new Date(endDate),
//                         status: true 
//                     }
//                 },
//                 { new: true }
//             );
            
//             console.log('Updated existing product offer:', updatedOffer);
//         } else {
            
//             const newOffer = new Offer({
//                 offerType: 'product',
//                 productId: productId,
//                 discount: discount,
//                 startDate: new Date(startDate),
//                 endDate: new Date(endDate),
//                 status: true
//             });
            
//             updatedOffer = await newOffer.save();
//             console.log('Created new product offer:', updatedOffer);
//         }
        
        
//         const updatedOffers = await Offer.find();
        
//         return res.render('admin/offerPage', {
//             message: { text: 'Product offer updated successfully', type: 'success' },
//             admin: req.session.admin,
//             active: 'offers',
//             offers: updatedOffers,
//             products: product,
//             categories
//         });
//     } catch (error) {
//         console.log('Error while editing product offer:', error);
        
//         return res.render('admin/offerPage', {
//             message: { text: 'Failed to update product offer', type: 'error' },
//             admin: req.session.admin,
//             active: 'offers',
//             offers: await Offer.find(),
//             products: await Product.find({ isBlocked: false }),
//             categories: await Category.find({ isDeleted: false })
//         });
//     }
// };
const loadEditOffer = async (req, res) => { 
    try {
        console.log('Starting to load the edit offer page');

        const id = req.query.id;
        console.log("id", id);

        const products = await Product.find({ isBlocked: false });
        const categories = await Category.find({ isListed: true, isBlocked: false });
        const offer = await Offer.findOne({ _id: id });

        console.log('offer', offer);

        if (!offer) {
            return res.status(404).redirect('/admin/offers');
        }

        res.render('admin/editOffer', { products, offer, categories });

    } catch (error) {
        console.log('Error loading edit offer page', error);
        res.status(500).redirect('/admin/error');
    }
};

const editOffer = async (req, res) => {
    try {
        console.log('Starting to edit offer');

        const { 
            id, 
            offerName, 
            discount, 
            startDate, 
            endDate, 
            offerType, 
            productId, 
            categoryId, 
            referralCode, 
            status, 
            maxRedemptions 
        } = req.body;

        // Basic validation
        if (!id || !offerName || discount === undefined || !startDate || !endDate || !offerType) {
            return res.status(400).json({ success: false, errorMessage: 'All required fields must be provided' });
        }

        // Offer name validation
        if (offerName.trim().length < 3) {
            return res.status(400).json({ success: false, errorMessage: 'Offer name must be at least 3 characters long' });
        }

        // Discount validation
        const discountValue = parseFloat(discount);
        if (isNaN(discountValue) || discountValue < 0 || discountValue > 100) {
            return res.status(400).json({ success: false, errorMessage: 'Discount must be between 0 and 100' });
        }

        // Date validation
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ success: false, errorMessage: 'Invalid date format' });
        }

        if (start >= end) {
            return res.status(400).json({ success: false, errorMessage: 'End date must be after start date' });
        }

        // Offer type validation
        if (!['product', 'category', 'referral'].includes(offerType)) {
            return res.status(400).json({ success: false, errorMessage: 'Invalid offer type' });
        }

        // Prepare the updated offer object
        const updatedOffer = { 
            offerName, 
            discount: discountValue, 
            startDate: start, 
            endDate: end, 
            offerType,
            status: status === 'true'
        };

        // Add maxRedemptions if provided
        if (maxRedemptions) {
            const maxRedemptionsValue = parseInt(maxRedemptions);
            if (!isNaN(maxRedemptionsValue) && maxRedemptionsValue >= 1) {
                updatedOffer.maxRedemptions = maxRedemptionsValue;
            } else {
                updatedOffer.maxRedemptions = null; // Clear the value if invalid
            }
        } else {
            updatedOffer.maxRedemptions = null; // Clear the value if not provided
        }

        // Handle specific offer types
        if (offerType === 'product') {
            console.log('Processing product offer');
            if (!productId) {
                return res.status(400).json({ success: false, errorMessage: 'Product ID is required for product-type offers' });
            }

            const product = await Product.findById(productId);
            if (!product) {
                return res.status(404).json({ success: false, errorMessage: 'Product not found' });
            }

            updatedOffer.productId = productId;
            updatedOffer.categoryId = undefined;
            updatedOffer.referralCode = undefined;

        } else if (offerType === 'category') {
            console.log('Processing category offer');
            if (!categoryId) {
                return res.status(400).json({ success: false, errorMessage: 'Category ID is required for category-type offers' });
            }

            const category = await Category.findById(categoryId);
            if (!category) {
                return res.status(404).json({ success: false, errorMessage: 'Category not found' });
            }

            updatedOffer.categoryId = categoryId;
            updatedOffer.productId = undefined;
            updatedOffer.referralCode = undefined;

        } else if (offerType === 'referral') {
            console.log('Processing referral offer');
            if (!referralCode || referralCode.trim() === '') {
                return res.status(400).json({ success: false, errorMessage: 'Referral code is required for referral-type offers' });
            }

           
            const existingOffer = await Offer.findOne({ 
                referralCode, 
                _id: { $ne: id } 
            });
            
            if (existingOffer) {
                return res.status(400).json({ success: false, errorMessage: 'This referral code is already in use' });
            }

            updatedOffer.referralCode = referralCode.trim();
            updatedOffer.productId = undefined;
            updatedOffer.categoryId = undefined;
        }

        // Find the current offer to check for changes
        const currentOffer = await Offer.findById(id);
        if (!currentOffer) {
            return res.status(404).json({ success: false, errorMessage: 'Offer not found' });
        }

        // Apply product offer changes if needed
        if (currentOffer.offerType === 'product' && currentOffer.productId) {
            // If this is a product offer and we're changing the product or offer type
            if (offerType !== 'product' || (productId && currentOffer.productId.toString() !== productId)) {
                // Reset the old product
                await handleProductOfferRemoval(currentOffer.productId);
            }
        }
        
        // Apply category offer changes if needed
        if (currentOffer.offerType === 'category' && currentOffer.categoryId) {
            // If this is a category offer and we're changing the category or offer type
            if (offerType !== 'category' || (categoryId && currentOffer.categoryId.toString() !== categoryId)) {
                // Reset the old category products
                await handleCategoryOfferRemoval(currentOffer.categoryId);
            }
        }

        // Update the offer in the database
        await Offer.findByIdAndUpdate(id, updatedOffer, { new: true });
        console.log('Offer updated successfully:', updatedOffer);

        // Apply new changes based on offer type
        if (offerType === 'product' && productId) {
            await applyProductOffer(productId, discountValue, id);
        } else if (offerType === 'category' && categoryId) {
            await applyCategoryOffer(categoryId, discountValue, id);
        }

        return res.json({ success: true, message: 'Offer edited successfully' });
    } catch (error) {
        console.error('Error editing offer:', error);
        res.status(500).json({ success: false, errorMessage: 'Error editing offer: ' + error.message });
    }
};

const handleProductOfferRemoval = async (productId) => {
    try {
        const product = await Product.findById(productId);
        if (product) {
            // Reset the product's offer-related fields
            await Product.findByIdAndUpdate(
                productId,
                {
                    $unset: { productOfferId: "", productDiscount: "" }
                },
                { new: true }
            );
            console.log(`Reset offer fields for product ${productId}`);
        }
    } catch (error) {
        console.error('Error handling product offer removal:', error);
        throw error;
    }
};

// Helper function to handle category offer removal
const handleCategoryOfferRemoval = async (categoryId) => {
    try {
        const categoryProducts = await Product.find({ category: categoryId });
        
        for (const product of categoryProducts) {
            await Product.findByIdAndUpdate(
                product._id,
                {
                    $unset: { categoryOfferId: "", categoryDiscount: "" }
                },
                { new: true }
            );
            console.log(`Reset category offer fields for product ${product._id}`);
        }

        // Update category offer status
        await Category.findByIdAndUpdate(
            categoryId,
            { $set: { categoryOffer: 0 } },
            { new: true }
        );
    } catch (error) {
        console.error('Error handling category offer removal:', error);
        throw error;
    }
};

// Helper function to apply a product offer
const applyProductOffer = async (productId, discount, offerId) => {
    try {
        const product = await Product.findById(productId);
        if (!product) {
            throw new Error(`Product ${productId} not found`);
        }
        
        await Product.findByIdAndUpdate(
            productId,
            {
                $set: {
                    productOfferId: offerId,
                    productDiscount: discount
                }
            },
            { new: true }
        );
        
        console.log(`Applied product offer to product ${productId}`);
    } catch (error) {
        console.error('Error applying product offer:', error);
        throw error;
    }
};

// Helper function to apply a category offer
const applyCategoryOffer = async (categoryId, discount, offerId) => {
    try {
        const category = await Category.findById(categoryId);
        if (!category) {
            throw new Error(`Category ${categoryId} not found`);
        }
        
        // Update the category's offer value
        await Category.findByIdAndUpdate(
            categoryId,
            { $set: { categoryOffer: discount } },
            { new: true }
        );
        
        // Update all products in the category
        const categoryProducts = await Product.find({ category: categoryId });
        for (const product of categoryProducts) {
            await Product.findByIdAndUpdate(
                product._id,
                {
                    $set: {
                        categoryOfferId: offerId,
                        categoryDiscount: discount
                    }
                },
                { new: true }
            );
        }
        
        console.log(`Applied category offer to category ${categoryId} with ${categoryProducts.length} products`);
    } catch (error) {
        console.error('Error applying category offer:', error);
        throw error;
    }
};


module.exports = {
    getOfferPage,
    getAddOfferPage,
    addOffer,
    deleteOffer,
    loadEditOffer,
    editOffer
    // editCategoryOffer,
    // editProductOffer
}