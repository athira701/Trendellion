const Product = require('../../models/productSchema')
const Category = require('../../models/categorySchema')
const User = require('../../models/userSchema')
const fs = require('fs')
const path = require('path')
const multer=require('multer')

// const sharp = require('sharp')

const getProductPage = async (req, res) => {
    try {
        console.log("hellooo");
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.max(1, parseInt(req.query.limit) || 10);
        const skip = (page - 1) * limit;

        const totalProducts = await Product.countDocuments();
        const products = await Product.find({})
            .select('productName productImage quantity category salePrice color isBlocked')
            .populate('category') // Populate only the 'name' field of category
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalPages = Math.ceil(totalProducts / limit);

        res.render('admin/allProduct', {
            products,
            currentPage: page,
            totalPages,
            limit,
        });
    } catch (error) {
        console.error('Error loading product page:', error);
        res.status(500).render('error', { message: 'Unable to load products. Please try again later.' });
    }
};




const getProductAddPage = async (req, res) => {
    try {
        const category = await Category.find({ isListed: true });
        res.render("admin/addProduct", { cat: category });
    } catch (error) {
        console.error("Error fetching categories:", error);
        res.status(500).send("Internal Server Error");
    }
};

const deleteProduct = async (req, res) => {
    const productId = req.params.id;
    console.log("idddddd",productId);

    try {
        
        const result = await Product.findByIdAndUpdate({_id:productId}, { $set:{isBlocked: true} });
        console.log("resss",result);

        if (result) {
            return res.status(200).json({ success: true, message: 'product soft deleted successfully' });
        } else {
            return res.status(404).json({ success: false, error: 'product not found' });
        }
    } catch (error) {
        console.error('Error soft deleting product:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

const restoreProduct = async (req, res) => {
    const productId = req.params.id;


    try {
        const result = await Product.findByIdAndUpdate({_id:productId}, {$set:{isBlocked: false} });

        if (result) {
            return res.status(200).json({ success: true, message: "product restored successfully" });
        } else {
            return res.status(404).json({ success: false, error: "product not found" });
        }
    } catch (error) {
        console.error("Error restoring product:", error);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
};



const addProduct = async (req, res) => {
    try {
        const details = req.body;
        const files = req.files;

        console.log('Full Request Body:', req.body);
        // console.log("Size specifically:",req.body.size)
        // console.log('Files:', req.files);
        
        // Comprehensive validation with null checks
        const validationErrors = [];

        // Function to safely trim or return empty string
        const safeTrim = (value) => value ? value.trim() : '';

        // Validate name
        const productName = safeTrim(details.productName);
        const namePattern = /^[A-Za-z][A-Za-z\s]{2,}$/;
        if (!namePattern.test(productName)) {
            console.log('name pattern',namePattern);
            validationErrors.push('Product name must contain only alphabets, start with a letter, and have at least 3 characters.');
        }
        console.log("productname",productName)

        // Check for existing product
        const existingProduct = await Product.findOne({
            productName: { $regex: new RegExp('^' + productName + '$', 'i') }
        });

        if (existingProduct) {
            validationErrors.push('A product with this name already exists.');
        }
        // let sizes = details.size || []
        //const sizes = Array.isArray(details.size) ? details.size : [details.size];
        // if (details.size) {
        //     // Ensure sizes is always an array
        //     sizes = Array.isArray(details.size) 
        //         ? details.size 
        //         : [details.size];
            
        //     // Clean and filter sizes
        //     sizes = sizes.map(size => size.trim()).filter(size => size);
        // }

        // console.log('Raw Size Input:', details.size);
        // console.log('Processed Sizes:', sizes);

        // Validate price
        const price = parseFloat(details.price);
        if (isNaN(price) || price <= 0) {
            console.log('price',price);
            validationErrors.push('Price must be a positive number');
        }

        // Validate sale price
        const sPrice = parseFloat(details.sPrice);
        if (isNaN(sPrice) || sPrice < 0 || sPrice > price) {
            validationErrors.push('Sale Price must be a non-negative number and less than or equal to Price.');
        }

        // Validate quantity
        const quantity = parseInt(details.quantity);
        if (isNaN(quantity) || quantity <= 0) {
            validationErrors.push('Quantity must be a positive number.');
        }

        // Validate category
        const categoryId = safeTrim(details.categoryId);
        if (!categoryId) {
            validationErrors.push('Please select a category.');
        }

        // Validate description
        const description = safeTrim(details.description);
        if (description.length < 10 || description.length > 250) {
            validationErrors.push('Product description must have between 10 and 250 characters.');
        }

        // Validate color
        const color = safeTrim(details.color);
        const colorPattern = /^[A-Za-z][A-Za-z\s]{1,}$/;
        if (!colorPattern.test(color)) {
            validationErrors.push('Color must contain only alphabets and start with a letter.');
        }

        // Check image uploads
        if (!files || files.length < 4) {
            validationErrors.push('Please upload at least 4 images.');
        }

        console.log("reached ")

        // If there are validation errors, return them
     
        console.log("heloooo1")
        // Map uploaded images
        const images = files.map(file => file.filename);
        console.log("heloooo2")

        const totalStock= parseInt(details.size_s)+parseInt(details.size_m)+parseInt(details.size_l)+parseInt(details.size_xl)


        // Create product object
        const product = new Product({
            productName: productName,
            description: description,
            brand: safeTrim(details.brand) || "Unknown",
            category: categoryId,
            regularPrice: price,
            salePrice: sPrice,
           
            stock: [
                {
                    size: 'S',
                    quantity: details.size_s
                },
                {
                    size: 'M',
                    quantity: details.size_m
                },
                {
                    size: 'L',
                    quantity: details.size_l
                },
                {
                    size: 'XL',
                    quantity: details.size_xl
                }
            ],
            totalStock,
           
            productImage: images,
            status: safeTrim(details.visibility) || "Available"
        });

        // Save product to database
        const savedProduct = await product.save();
        console.log("product",savedProduct)
        console.log('Saved Product Sizes:', savedProduct.size);


        res.status(200).json({ 
            success: true, 
            message: 'Product added successfully.', 
            product: savedProduct 
        });

    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Internal server error.',
            error: error.message 
        })
    }
}

const loadEditProduct = async (req, res) => {
    try {
        console.log('product editing page loading');
        const id = req.query.id

        console.log(req.query)
        console.log("id", id);

        const proData = await Product.findById({ _id: id })
        console.log("product",proData)

        const size = proData ? proData.size || [] : [];

        const categories = await Category.find()
        const selectedCategory = await Category.findById({ _id: proData.category })
        console.log("sele",selectedCategory)
        console.log("cattt",categories);
        console.log(proData);

        if (proData) {
            console.log('reached here');
            res.render('admin/editProduct', { product: proData,  categories,selectedCategory,size })
        } else {
            res.redirect('/admin/allProduct')
        }
    } catch (error) {
        console.log('error editing product');
        console.log(error);
    }
}



const editProduct = async (req, res) => {
    try {
        console.log('Edit product request received');

        const productId = req.params.id;
        const {
            productName,
            price,
            sPrice,
            color,
            size,
            quantity,
            description,
            categoryId,
            visibility
        } = req.body;

        if (!/^[A-Za-z][A-Za-z ]*$/.test(productName)) {
            return res.status(400).json({ success: false, message: 'Product name should contain only alphabets and not start with a space.' });
        }
        if (!description.trim() || description.length < 10 || description.length > 250) {
            return res.status(400).json({ success: false, message: 'Description must be between 10 to 250 characters and should not start with a space.' });
        }
        if (!/^[1-9][0-9]*$/.test(price) || price <= 0) {
            return res.status(400).json({ success: false, message: 'Price must be a positive number and not zero.' });
        }
        if (!/^[1-9][0-9]*$/.test(sPrice) || sPrice < 0 || sPrice > price) {
            return res.status(400).json({ success: false, message: 'Sale Price must be a non-negative number and less than or equal to Price.' });
        }
        if (!/^[A-Za-z]+$/.test(color)) {
            return res.status(400).json({ success: false, message: 'Color should contain only alphabets and no numbers.' });
        }
        if (!/^[1-9][0-9]*$/.test(quantity) || quantity <= 0) {
            return res.status(400).json({ success: false, message: 'Quantity must be a positive number and not zero.' });
        }

        // Find the existing product
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found',
            });
        }

        // Update product fields
        product.productName = productName;
        product.regularPrice = price;
        product.salePrice = sPrice;
        product.color = color;
        product.size = size;
        product.quantity = quantity;
        product.description = description;
        product.category = categoryId;
        product.visibility = visibility;

        // Handle image uploads
        if (req.files && req.files.length > 0) {
            const uploadedImages = req.files.map(file => file.filename);

            // Delete old images if new ones are provided
            if (product.productImage && product.productImage.length > 0) {
                product.productImage.forEach(image => {
                    const imagePath = path.join(__dirname, '../public/uploads', image);
                    if (fs.existsSync(imagePath)) {
                        fs.unlinkSync(imagePath);
                    }
                });
            }

            // Update product images with new uploads
            product.productImage = uploadedImages;
        }

        // Save updated product to the database
        await product.save();

        res.status(200).json({
            success: true,
            message: 'Product updated successfully',
            redirectUrl: '/admin/allProduct',
        });
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while updating the product',
        });
    }
}

const updateProductImages = async (req, res) => {
    try {
        const { productId, imageIndex } = req.body; // Get product ID and image index from request
        const product = await Product.findById(productId);

        console.log("ImageInfo & imageIndex:",productId, imageIndex)

        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        // Ensure the productImage array exists
        if (!product.productImage || !Array.isArray(product.productImage)) {
            product.productImage = [];
        }

        // Update only the selected image index
        product.productImage[imageIndex] = req.file.filename; 

        // Save the updated product
        await product.save();

        res.json({ success: true, updatedImage: product.productImage });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error updating image", error });
    }
};

module.exports = {
    getProductPage,
    addProduct,
    getProductAddPage,
    deleteProduct,
    restoreProduct,
    loadEditProduct ,
    editProduct,
    updateProductImages
}