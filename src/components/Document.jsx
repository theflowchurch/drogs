const basePath=process.env.NEXT_PUBLIC_BASE_PATH || '';
export const siteMetadata={
  title:'Kuriake Castle',
  description:'Kuriake Castle annual leadership commitment',
  icons:{icon:`${basePath}/assets/brand/castle-tab-icon.png`,apple:`${basePath}/assets/brand/castle-app-icon.png`},
};
export const siteViewport={themeColor:'#0d242b'};
export default function Document({children,surface}){
  return <html lang="en"><body data-surface={surface}>
    {children}
    <noscript><p>Please enable JavaScript to use this website.</p></noscript>
  </body></html>;
}
