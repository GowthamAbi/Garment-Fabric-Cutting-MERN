export default function MobileMenu({ open, onClose }) {
  return open ? <div className="shade" onClick={onClose} /> : null;
}
