import React, { createContext, useContext, useState } from 'react';

const FaceVerificationContext = createContext();

export const FaceVerificationProvider = ({ children }) => {
  const [verificationResult, setVerificationResult] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const value = {
    verificationResult,
    setVerificationResult,
    isVerifying,
    setIsVerifying,
  };

  return (
    <FaceVerificationContext.Provider value={value}>
      {children}
    </FaceVerificationContext.Provider>
  );
};

export const useFaceVerification = () => {
  const context = useContext(FaceVerificationContext);
  if (!context) {
    throw new Error('useFaceVerification must be used within a FaceVerificationProvider');
  }
  return context;
};