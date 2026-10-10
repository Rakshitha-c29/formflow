const mongoose = require("mongoose");
const { ROLES, ROLE_VALUES } = require("../constants/roles");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      // Excluded from every query unless explicitly requested with .select("+password")
      select: false,
    },

    role: {
      type: String,
      enum: ROLE_VALUES,
      default: ROLES.EMPLOYEE,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);