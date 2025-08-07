import * as Yup from 'yup';

export const validationSchema = Yup.object().shape({
  phoneNumber: Yup.string()
    .matches(/^(09)\d{9}$/, 'Invalid Iranian mobile number. Please enter a valid number starting with "09"')
    .required('Phone number is required'),
});