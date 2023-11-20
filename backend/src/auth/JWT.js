const {sign, verify} = require('jsonwebtoken')
const rateLimit = require('express-rate-limit');
const secret_key = process.env.JWT_SECRET

const createToken = (user) => {
    let userId;
    if (user.userType === 'customer') {
        userId = user.CustomerID;
    } else if (user.userType === 'admin') {
        userId = user.AdminID;
    } else {
        throw new Error('Invalid user type');
    }

    const payload = {
        userId: user.userId,
        username: user.username,
        role: user.userType,
    };

    const token = sign(payload, secret_key, { expiresIn: '1h' });

    return token;
};


const validateToken = (req, res, next) => {
    const accessToken = req.cookies['access-token'];
    console.log(accessToken)

    if (!accessToken) {
        return res.status(401).json({ error: "Access Denied (Not Authenticated)" });
    }

    try {
        const validToken = verify(accessToken, secret_key);
        if (validToken) {
            // Populate req.user with user information from the token payload
            req.user = {
                userId: validToken.userId,
                username: validToken.username,
                role: validToken.role
            };
            return next();
        }
    } catch (err) {
        return res.status(401).json({ error: "Invalid token" });
    }
};

const resetPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes window
    max: 5, // limit each IP to 5 requests per windowMs
    message: { error: 'Too many password reset requests from this IP, please try again later.' }
  });

module.exports = { createToken, validateToken, resetPasswordLimiter }