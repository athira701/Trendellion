//const Joi = require('joi')
const Coupon = require('../../models/couponSchema')
const mongoose = require('mongoose')

const loadCouponpage = async (req,res) =>{
    try {
        const coupons = await Coupon.find().sort({ createdAt: -1})
        console.log('coupons:',coupons)

        const message = req.query.message ? 
            { text: req.query.message, type: 'success' } : null;
        
            console.log("checking");

        res.render('admin/allCoupons',{
            admin: req.session.admin, 
            active: 'coupons' ,
            coupon: coupons,
            message: message 
        })
        console.log("again checking");
    } catch (error) {
        console.log('error while loading couponManagement',error)
    }
}

const loadAddCouponPage = async (req, res) => {
    try {
        res.render('admin/addCoupon', {
            admin: req.session.admin,
            active: 'coupons',
            message: null
        });
    } catch (error) {
        console.log('Error loading add coupon page', error);
        res.redirect('/admin/coupons?message=Error loading add coupon page');
    }
};

 
// const couponSchema = Joi.object({
//     code: Joi.string().trim().required().messages({
//         'string.empty': 'Coupon code is required',
//         'any.required': 'Coupon code is required'
//     }),
//     discount: Joi.number().min(0).max(100).required().messages({
//         'number.base': 'Discount must be a number',
//         'number.min': 'Discount must be between 0 and 100',
//         'number.max': 'Discount must be between 0 and 100',
//         'any.required': 'Discount is required'
//     }),
//     minimumPrice: Joi.number().min(0).required().messages({
//         'number.base': 'Minimum price must be a number',
//         'number.min': 'Minimum price must be a positive number',
//         'any.required': 'Minimum price is required'
//     }),
//     maxRedeem: Joi.number().integer().min(1).required().messages({
//         'number.base': 'Max redeemable must be a number',
//         'number.min': 'Max redeemable must be at least 1',
//         'any.required': 'Max redeemable is required'
//     }),
//     expiry: Joi.date().greater('now').required().messages({
//         'date.base': 'Expiry date must be a valid date',
//         'date.greater': 'Expiry date must be in the future',
//         'any.required': 'Expiry date is required'
//     })
// });

const addCoupon = async (req,res) => {
    try {
        // const coupon = await Coupon.find()
        // console.log("addcouponile coupon:",coupon);
        const { code, discount, minimumPrice, maxRedeem, expiry } = req.body;
        console.log('req.body',req.body)

        if(!code||!discount||!minimumPrice||!maxRedeem||!expiry){
            const coupons = await Coupon.find();
            return res.render('admin/allCoupons', {
                message: { text: 'All fields are required', type: 'error' },
                admin: req.session.admin,
                active: 'coupons',
                coupons: coupons       
            });
        }

        if (code) {
            const existingCoupon = await Coupon.findOne({ 
                couponCode: code.trim().toUpperCase() 
            });
            
            if (existingCoupon) {
                return res.render('admin/addCoupon', {
                    message: { text: 'Coupon code already exists', type: 'error' },
                    admin: req.session.admin,
                    active: 'coupons',
                    formData: req.body
                });
            }
        }

        const newCoupon = new Coupon({
            couponCode: code.trim().toUpperCase(),
            discount: Number(discount),
            minimumPrice: Number(minimumPrice),
            maxRedeem: Number(maxRedeem),
            expiry: new Date(expiry),
            status: true
        })

        await newCoupon.save();
        // const updatedCoupon = await Coupon.find()

        // return res.render('admin/addCoupon', {
        //     message: { text: 'Coupon created successfully', type: 'success' },
        //     admin: req.session.admin,
        //     active: 'coupons',
        //     coupon:updatedCoupon
        // });

        return res.redirect('/admin/coupons?message=Coupon created successfully&type=success');
    } catch (error) {
        console.log('error while creating coupons',error)   
    }
}



const editCoupon = async (req, res) => {
    try {
        console.log("Req body commonnnnn:", req.body);
        const { couponId, code, minimumPrice, maxRedeem, expiry, discount } = req.body;
        
        const updatedCoupon = await Coupon.findOneAndUpdate(
            { _id: couponId },
            {
                $set: {
                    couponCode: code,
                    discount: discount,
                    minimumPrice: minimumPrice,
                    maxRedeem: maxRedeem,
                    expiry: expiry
                }
            },
            { new: true }
        );
        
        if (!updatedCoupon) {
            // If no document was found to update
            return res.redirect('/admin/coupons?message=error&text=' + encodeURIComponent('Coupon not found. Update failed.'));
        } else {
            // Success message
            return res.redirect('/admin/coupons?message=success&text=' + encodeURIComponent('Coupon updated successfully!'));
        }
    } catch (error) {
        console.log('error while editing coupon', error);
        return res.redirect('/admin/coupons?message=error&text=' + encodeURIComponent('Failed to update coupon. Please try again.'));
    }
};

const deleteCoupon = async (req,res) =>{
    try {
        const couponId=req.params.id
        const coupon = await Coupon.findOne({_id:couponId})

        const togglestatus = coupon.status == true ? false : true

        await Coupon.findOneAndUpdate({_id:couponId},{
            $set:{
                status:togglestatus
            }
        },{new:true})
        
    
        res.redirect('/admin/coupons')
      
        
    } catch (error) {
        console.log('error while delete coupon',error)
    }
}






module.exports = {
    loadCouponpage,
    loadAddCouponPage,
    addCoupon,
    editCoupon,
    deleteCoupon
}