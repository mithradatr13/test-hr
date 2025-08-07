import { useState } from 'react';
import { useRouter } from 'next/router';
import Input from '@/components/input';
import Button from '@/components/button';
import styles from '../styles/styles.module.scss';


const Auth = () => {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');

  const handleLogin = async () => {
    if (!/^(09)\d{9}$/.test(phoneNumber)) {
      alert('Invalid Iranian mobile number. Please enter a valid number starting with "09".');
      return;
    }
    const response = await fetch('https://randomuser.me/api/?results=1&nat=us');
    const data = await response.json();
    localStorage.setItem('userData', JSON.stringify(data.results[0]));
    router.push('/dashboard');
  };

  return (
    <div className={styles.authcontainer}>
      <h1>Login</h1>
      <div className={styles.inputcontainer}>
        <Input
          name="input_login"
          placeholder="Phone Number"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
        />
      </div>
      <Button
        onClick={handleLogin}
        text="Log In"
      />

    </div>
  );
};

export default Auth;