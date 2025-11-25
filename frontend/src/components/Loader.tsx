"use client";
import React from "react";

const Loader = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
      <div className="relative flex items-center justify-center mb-8">
        {/* Outer rotating ring */}
        <div className="w-24 h-24 border-4 border-gray-800 border-t-white rounded-full animate-spin-slow"></div>

        {/* Inner pulsing dot */}
        <div className="absolute w-8 h-8 bg-white rounded-full animate-ping opacity-80"></div>
      </div>

      {/* Loader text with inline spinning icon */}
      <div className="flex items-center space-x-2 text-gray-300 tracking-widest text-sm sm:text-base whitespace-nowrap">
        {/* <LoaderCircle className="w-4 h-4 animate-spin text-white" /> */}
        <span className="animate-pulse">Registering User...</span>
      </div>
    </div>
  );
};

export default Loader;
