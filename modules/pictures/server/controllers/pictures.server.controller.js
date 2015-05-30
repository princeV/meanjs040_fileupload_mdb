'use strict';

/**
 * Module dependencies.
 */
var _ = require('lodash'),
    fs = require('fs'),
    path = require('path'),
    async = require('async'),
    mongoose = require('mongoose'),
    lwip = require('lwip'),
    Picture = mongoose.model('Picture'),
    errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller'));

var Grid = require('gridfs-stream');
Grid.mongo = mongoose.mongo;
var gfs = new Grid(mongoose.connection.db);


function calculateMinImageSize(maxWidth, maxHeight, image) {
    var aspectRatio = maxHeight / maxWidth;
    var imgageAspectRatio = image.height() / image.width();
    var targetwidth = maxWidth;
    var targetheight = maxHeight;

    if (aspectRatio > imgageAspectRatio) {
        targetheight = targetwidth / image.width() * image.height();
    }
    else {
        targetwidth = targetheight / image.height() * image.width();
    }

    var imageSize = {
        width: targetwidth,
        height: targetheight
    };

    return imageSize;
}

function calculateMaxImageSize(maxWidth, maxHeight, image) {
    var aspectRatio = maxHeight / maxWidth;
    var imgageAspectRatio = image.height() / image.width();
    var targetwidth = maxWidth;
    var targetheight = maxHeight;

    if (aspectRatio < imgageAspectRatio) {
        targetheight = targetwidth / image.width() * image.height();
    }
    else {
        targetwidth = targetheight / image.height() * image.width();
    }

    var imageSize = {
        width: targetwidth,
        height: targetheight
    };

    return imageSize;
}


/**
 * Create a Picture
 */
exports.create = function (req, res) {
    var picture = new Picture(req.body);
    picture.user = req.user;
    picture.save(function (err) {
        if (err) {
            return res.status(400).send({
                message: errorHandler.getErrorMessage(err)
            });
        } else {
            res.jsonp(picture);
        }
    });
};


exports.findPictureGridFs = function (req, res) {

    res.set('Content-Type', req.pictureGridFs.contentType);
    //res.set('Content-Disposition', 'attachment; filename=image.jpg');
    var readstream = gfs.createReadStream({
        //get the square size for tests:
        _id: req.pictureGridFs._id
    });

    //error handling, e.g. file does not exist
    readstream.on('error', function (err) {
        console.log('An error occurred!', err);
        throw err;
    });

    readstream.pipe(res);
};
/**
 * Show the current Picture
 */
exports.read = function (req, res) {
    res.jsonp(req.picture);
};

/**
 * Update a Picture
 */
exports.update = function (req, res) {
    var picture = req.picture;

    picture = _.extend(picture, req.body);

    picture.save(function (err) {
        if (err) {
            return res.status(400).send({
                message: errorHandler.getErrorMessage(err)
            });
        } else {
            res.jsonp(picture);
        }
    });
};

/**
 * Delete an Picture
 */
exports.delete = function (req, res) {
    var picture = req.picture;
    var waterfallFunctions = [];

    //loop through the array of the picture sizes:
    var i;
    for (i = 0; i < picture.sizes.length; i++) {
        var unlinkPictureObject = {
            fileId: picture.sizes[i].files_id,
            /* jshint loopfunc:true */
            unlinkPicture: function (callback) {
                // remove the greidFS file via id:
                gfs.remove({_id: this.fileId}, function (error) {
                    if (error) {
                        callback(error);
                    } else {
                        callback(null);
                    }
                });
            }
        };
        // add the function to the waterfallarray:
        waterfallFunctions.push(unlinkPictureObject.unlinkPicture.bind(unlinkPictureObject));
    }

    waterfallFunctions.push(
        function (callback) {
            picture.remove(function (error) {
                if (error) {
                    callback(error);
                } else {
                    callback(null);
                }
            });
        }
    );

    async.waterfall(waterfallFunctions, function (error) {
        if (error) {
            return res.status(400).send({
                message: errorHandler.getErrorMessage(error)
            });
        }
        else {
            res.jsonp(picture);
        }
    });
};

/**
 * List of Pictures
 */
exports.list = function (req, res) {
    Picture.find().sort('-created').populate('user', 'displayName').exec(function (err, pictures) {
        if (err) {
            return res.status(400).send({
                message: errorHandler.getErrorMessage(err)
            });
        } else {
            res.jsonp(pictures);
        }
    });
};

/**
 * Picture middleware
 */
exports.pictureByID = function (req, res, next, id) {
    Picture.findById(id).populate('user', 'displayName').exec(function (err, picture) {
        if (err) return next(err);
        if (!picture) return next(new Error('Failed to load Picture ' + id));

        req.picture = picture;
        next();
    });

};


/**
 * Picture GridFS middleware
 */
exports.pictureGridFsByID = function (req, res, next, id) {
    gfs.findOne({_id: id}, function (err, file) {
        if (err) return next(err);
        if (!file) return next(new Error('Failed to load File ' + id));

        req.pictureGridFs = file;
        next();

    });

};


/**
 * Update profile picture
 */
exports.uploadImage = function (req, res) {
    var picture = new Picture(req.body);
    picture.user = req.user;
    picture.sizes = [];
    picture.fileName = req.files.file.originalname;

    console.log(req);

    var pictureNameFull = req.files.file.originalname;
    var pictureExtension = req.files.file.extension.toLowerCase();
    var pictureMimeType = req.files.file.mimetype;
    var pictureName = pictureNameFull.substr(0, pictureNameFull.lastIndexOf('.'));
    var pictureBuffer = req.files.file.buffer;

    async.waterfall([
        function openLwip(openLwipCallback) {
            lwip.open(pictureBuffer, pictureExtension, function (error, image) {
                if (error) {
                    openLwipCallback(error);
                } else {
                    openLwipCallback(null, image);
                }
            });
        },
        function createLargeImageBuffer(image, callback) {
            //calculate the image height:
            var imageSize = calculateMinImageSize(1024, 768, image);
            image.batch()
                .resize(imageSize.width, imageSize.height, 'lanczos')
                .toBuffer(pictureExtension, function (error, buffer) {
                    if (error) {
                        callback(error);
                    } else {
                        callback(null, image, buffer);
                    }
                });
        },
        function writeLargeImageGridFs(image, buffer, callback) {
            var pictureLabel = 'large';
            var writeStream = gfs.createWriteStream({
                filename: pictureName + '_' + pictureLabel + '.' + pictureExtension,
                mode: 'w',
                content_type: pictureMimeType
            });
            // fs.createReadStream(picturePathFull).pipe(writeStream);
            writeStream.write(buffer);
            writeStream.end();
            writeStream.on('close', function (file) {
                var pictureSize = {
                    files_id: file._id,
                    label: pictureLabel,
                    source: 'api/pictures/download/' + file._id,
                    width: image.width(),
                    height: image.height()
                };
                picture.sizes.push(pictureSize);
                callback(null, image);
            });
            writeStream.on('error', function (error) {
                callback(error);
            });
        },
        function createMediumImageBuffer(image, callback) {
            //calculate the image height:
            var imageSize = calculateMinImageSize(640, 480, image);
            image.batch()
                .resize(imageSize.width, imageSize.height, 'lanczos')
                .toBuffer(pictureExtension, function (error, buffer) {
                    if (error) {
                        callback(error);
                    } else {
                        callback(null, image, buffer);
                    }
                });
        },
        function writeMediumImageGridFs(image, buffer, callback) {
            var pictureLabel = 'medium';
            var writeStream = gfs.createWriteStream({
                filename: pictureName + '_' + pictureLabel + '.' + pictureExtension,
                mode: 'w',
                content_type: pictureMimeType
            });
            // fs.createReadStream(picturePathFull).pipe(writeStream);
            writeStream.write(buffer);
            writeStream.end();
            writeStream.on('close', function (file) {
                var pictureSize = {
                    files_id: file._id,
                    label: pictureLabel,
                    source: 'api/pictures/download/' + file._id,
                    width: image.width(),
                    height: image.height()
                };
                picture.sizes.push(pictureSize);
                callback(null, image);
            });
            writeStream.on('error', function (error) {
                callback(error);
            });
        },
        function createSquareImageBuffer(image, callback) {
            //calculate the image height:
            var imageSquareSize = {width: 150, height: 150};
            var imageSize = calculateMaxImageSize(imageSquareSize.width, imageSquareSize.height, image);
            image.batch()
                .resize(imageSize.width, imageSize.height, 'lanczos')
                .crop(imageSquareSize.width, imageSquareSize.height)
                .toBuffer(pictureExtension, function (error, buffer) {
                    if (error) {
                        callback(error);
                    } else {
                        callback(null, image, buffer);
                    }
                });
        },
        function writeSquareImageGridFs(image, buffer, callback) {
            var pictureLabel = 'square';
            var writeStream = gfs.createWriteStream({
                filename: pictureName + '_' + pictureLabel + '.' + pictureExtension,
                mode: 'w',
                content_type: pictureMimeType
            });
            // fs.createReadStream(picturePathFull).pipe(writeStream);
            writeStream.write(buffer);
            writeStream.end();
            writeStream.on('close', function (file) {
                var pictureSize = {
                    files_id: file._id,
                    label: pictureLabel,
                    source: 'api/pictures/download/' + file._id,
                    width: image.width(),
                    height: image.height()
                };
                picture.sizes.push(pictureSize);
                callback(null);
            });
            writeStream.on('error', function (error) {
                callback(error);
            });
        },
        function savePictureToDB(callback) {
            picture.save(function (error) {
                if (error) {
                    callback(error);
                } else {
                    callback(null);
                }
            });
        }
    ], function (error) {
        if (error) {
            return res.status(400).send({
                message: error.toString()//'Error occurred while uploading the picture to the filesystem'
            });
        }
        else {
            res.jsonp(picture);
        }
    });
};
