// pages/dashboard.tsx

import { useEffect } from 'react';
import { useRouter } from 'next/router';

const Dashboard = () => {
  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem('userData');
    if (!userData) {
      router.push('/auth');
    }
  }, []);

  return (
    <div className="dashboard-container">
      <h1>Welcome to the Dashboard</h1>
    </div>
  );
};

export default Dashboard;