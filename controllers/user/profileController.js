const User = require('../../models/userSchema')
const bcrypt = require('bcrypt');

const getChangePassword = async (req,res) =>{
    try {
        res.render('user/changePassword')
    } catch (error) {
        
    }
}

const changePassword = async (req,res) =>{
    try {
        const { oldPassword, newPassword, confirmPassword } = req.body;
        const userId = req.session.user._id; 
        console.log("UserId kittumo:",userId)

        
        if (newPassword !== confirmPassword) {
            return res.status(400).json({success: false,message:'New passwords do not match'});
        }

        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({success: false,message: 'User not found'});
        }

        
        const isValidPassword = await bcrypt.compare(oldPassword, user.password);
        if (!isValidPassword) {
            return res.status(400).json ({success : false,message: 'Current password is incorrect'});
        }

        
        const hashedPassword = await bcrypt.hash(newPassword, 10);

       
        await User.findByIdAndUpdate(userId, {password: hashedPassword});

        
        res.status(200).json({success: true,message: 'Password changed successfully'})
    } catch (error) {
        console.error('Password change error:', error);
        res.status(400).json ({success: false,message: 'An error occurred while changing password'});
    }
}



module.exports = {
    getChangePassword,
    changePassword
}