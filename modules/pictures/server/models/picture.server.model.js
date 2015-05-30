'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
	Schema = mongoose.Schema;

/**
 * Picture Schema
 */
var PictureSchema = new Schema({
	name: {
		type: String,
		default: '',
		required: 'Please fill Picture name',
		trim: true
	},
	fileName: {
		type: String,
		default: '',
		required: 'fileName missing',
		trim: true
	},
	sizes: [{
		files_id:{
			type: String,
			default: '',
			trim: true
		},
		label: {
			type: String,
			default: '',
			trim: true
		},
		source: {
			type: String,
			default: '',
			trim: true
		},
		width: {
			type: Number,
			default: 0
		},
		height: {
			type: Number,
			default: 0
		}
	}],
	created: {
		type: Date,
		default: Date.now
	},
	user: {
		type: Schema.ObjectId,
		ref: 'User'
	}
});

mongoose.model('Picture', PictureSchema);
