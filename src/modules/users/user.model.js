import mongoose from 'mongoose';
import { ROLES } from '../../common/constants/roles.js';
import { EGYPT_PHONE_REGEX } from '../../common/validators/phone.js';

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
      // A unique index, not a validator: MongoDB rejects the duplicate (code
      // 11000 -> 409 in the error handler). lowercase runs before saving, so
      // "A@x.com" and "a@x.com" collide. The format is checked by Zod.
      unique: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      match: [EGYPT_PHONE_REGEX, 'Please fill a valid Egyptian phone number'],
    },
    // Always a bcrypt hash, never the plain password (hashed in the service).
    // select: false hides it from queries only; ask for it with +passwordHash.
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      required: true,
      enum: Object.values(ROLES),
      default: ROLES.CUSTOMER,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Empty until the first password change. Tokens issued before it are
    // rejected by the auth middleware (P2-T03).
    passwordChangedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    // __v stays in the database (it protects array updates done with save()),
    // but it is removed from responses together with the hash. select: false
    // does not cover the document returned by create()/save(); this does,
    // because res.json() calls toJSON().
    toJSON: {
      transform: (doc, ret) => {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export const User = mongoose.model('User', userSchema);
