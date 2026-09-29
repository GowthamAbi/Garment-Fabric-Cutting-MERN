export const tokenService = {
  clearLegacyLogin: () => {
    localStorage.removeItem("accessories_flow_token");
    localStorage.removeItem("accessories_flow_user");
  },
};
