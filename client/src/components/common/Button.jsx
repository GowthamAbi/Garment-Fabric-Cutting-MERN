export default function Button({ children, variant = "default", ...props }) {
  return (
    <button className={variant === "primary" ? "primary" : variant} {...props}>
      {children}
    </button>
  );
}
