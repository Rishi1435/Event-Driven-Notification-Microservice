const Joi = require('joi');

const eventPayloadSchema = Joi.object({
    userId: Joi.string().required(), // UUID or String
    email: Joi.string().email().required(),
    username: Joi.string().min(3).max(30).required()
}).unknown(true); // Allow other fields

const eventSchema = Joi.object({
    eventType: Joi.string().required(),
    timestamp: Joi.string().isoDate().required(),
    payload: eventPayloadSchema.required()
});

module.exports = eventSchema;
