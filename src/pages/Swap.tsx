import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Swap page — redirects to the Convert page which has the real swap logic.
 * This page was previously a mock with hardcoded rates and setTimeout.
 * The Convert page has the real backend-integrated swap via /api/transactions/swap.
 */
const Swap = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/convert", { replace: true });
  }, [navigate]);

  return null;
};

export default Swap;
