export interface UserProfile {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone?: string;
  address?: string;
  birthdate?: Date;
  paymentInfo?: Record<string, any>;
  preferences?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
