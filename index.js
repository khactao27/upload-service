const express = require('express');
const app = express();
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const jwt = require('jsonwebtoken')
const secretKey = process.env.v || '123'
const password = process.env.ENCRYPT_PASSWORD || 'b{m\\c;zG"ut?j_3M'
const port = process.env.PORT || 8010;
const Cryptr = require('cryptr')
const cryptr = new Cryptr(password)
const isDisableToken = 1 || !!+process.env.DISABLE_TOKEN

function encrypt(text) {
    return cryptr.encrypt(text)
}

function decrypt(encrypted) {
    return cryptr.decrypt(encrypted)
}

function verifyToken(token) {
    return new Promise((resolve, reject) => {
        jwt.verify(token, secretKey, (err, decoded) => {
            err ? reject(new Error(err)) : resolve(decoded)
        })
    })
}

const httpCode = {
    SUCCESS: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    TOKEN_EXPIRED: 409,
    UNKNOWN_ERROR: 520,
    FORBIDDEN: 403,
    UNAUTHORIZED: 401,
    ADMIN_REQUIRE: 406
}
const FOLDER = process.env.DEST_LOCATION || 'uploads'
app.use(cors())
app.use('/uploads', express.static(FOLDER))
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, FOLDER || 'uploads');
    },
    filename: (req, file, cb) => {
        console.log("File name", file);
        const ext = path.extname(file.originalname)
        const name = file.originalname.split('.')
        name.pop()
        cb(null, `ecommerce-${name.join('') || 'img'}-${Date.now()}${ext || '.png'}`);
    }
});
const fileFilter = (req, file, cb) => {
    // if (file.mimetype == 'image/jpeg' || file.mimetype == 'image/png') {
    cb(null, true);
    // } else {
    //     cb(null, false);
    // }
}
const upload = multer({storage: storage, fileFilter});

const verifyAccessToken = async (req, res, next) => {
    try {
        if (isDisableToken) {
            return next()
        }
        if (req.query.token) {
            const token = req.query.token
            if (token) {
                const data = decrypt(token)
                const {_id, idCongTy, expired} = JSON.parse(data)
                if (expired < Date.now() / 1000) {
                    return res.status(httpCode.BAD_REQUEST).json({msg: 'Đường dẫn đã hết hạn'})
                }
                if (_id && idCongTy) {
                    req.hopDongData = {_id, idCongTy}
                    return next()
                }
            }
            return res.status(httpCode.TOKEN_EXPIRED).json({})
        } else {
            const token = req.headers['x-access-token']
            console.log(token)
            const user = await verifyToken(token)
            console.log(user)
            req.user = user
            return next()
        }
    } catch (e) {
        console.error(e)
        res.status(httpCode.TOKEN_EXPIRED).json({})
    }
}
app.get('/download', (req, res) => {
    console.log(req.query.path, FOLDER, req.query.path.indexOf(FOLDER))
    if (req.query.path.indexOf(FOLDER) === 0) {
        return res.download(req.query.path)
    }
    res.status(404).json({})
})

//Upload route
app.post('/upload', verifyAccessToken, upload.single('file'), (req, res, next) => {
    try {
        console.log("upload complete", req.file)
        return res.status(200).json({
            msg: 'Tải lên thành công.',
            path: req.file.path
        });
    } catch (error) {
        console.error(error);
    }
});

app.post('/uploadMany', verifyAccessToken, upload.any(), (req, res, next) => {
    try {
        console.log("upload complete", req.files)
        return res.status(200).json({
            msg: 'Tải lên thành công.',
            path: req.files.map(i => i.path)
        });
    } catch (error) {
        console.error(error);
    }
});

app.listen(port, () => console.log(`Hello world app listening on port ${port}!`));
