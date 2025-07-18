import React from "react";
export const Input = ({ name, error, ...rest }) => (
  <div className="w-full">
    <input
      name={name}
      id={name}
      className={`w-full px-3 py-2 border rounded-md transition-colors bg-white ${
        error
          ? "border-red-500 focus:border-red-500 focus:ring-red-500/50"
          : "border-merqado-gray-medium/50 focus:border-merqado-blue focus:ring-merqado-blue/50"
      }`}
      {...rest}
    />
    {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
  </div>
);
