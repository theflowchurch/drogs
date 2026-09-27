import Document,{siteMetadata,siteViewport} from '../../components/Document';
import '../../registration/registration.css';
export const metadata={...siteMetadata,description:'Kuriake Castle annual registration for bishops and pastors'};
export const viewport=siteViewport;
export default function PortalLayout({children}){return <Document surface="registration">{children}</Document>}
