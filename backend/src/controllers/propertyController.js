const propertyService = require("../services/propertyService");
const asyncHandler = require("../utils/asyncHandler");

const listProperties = asyncHandler(async (req, res) => {
  const properties = await propertyService.listProperties(req.query, req.user);
  res.json(properties);
});

const getPropertyById = asyncHandler(async (req, res) => {
  const property = await propertyService.getPropertyById(
    req.params.id,
    req.user
  );
  res.json(property);
});

const createProperty = asyncHandler(async (req, res) => {
  const property = await propertyService.createProperty(req.body, req.user);
  res.status(201).json(property);
});

const updateProperty = asyncHandler(async (req, res) => {
  const property = await propertyService.updateProperty(
    req.params.id,
    req.body,
    req.user
  );
  res.json(property);
});

const addPropertyImages = asyncHandler(async (req, res) => {
  const property = await propertyService.addPropertyImages(
    req.params.id,
    req.files,
    req.user
  );
  res.status(201).json(property);
});

const deleteProperty = asyncHandler(async (req, res) => {
  await propertyService.deleteProperty(req.params.id, req.user);
  res.json({ success: true });
});

const deletePropertyImage = asyncHandler(async (req, res) => {
  await propertyService.deletePropertyImage(req.params.id, req.user);
  res.json({ success: true });
});

module.exports = {
  listProperties,
  getPropertyById,
  createProperty,
  updateProperty,
  addPropertyImages,
  deleteProperty,
  deletePropertyImage,
};
