import React from "react";
import { useTheme } from "../contexts/ThemeContext";

const PageLayout = ({ title, subtitle, children, className = "" }) => {
  const { theme } = useTheme();
  
  return (
    <div className={`${className}-container ${theme}`}>
      <div className="page-header-clean">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
};

export default PageLayout;