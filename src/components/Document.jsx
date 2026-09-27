const basePath=process.env.NEXT_PUBLIC_BASE_PATH || '';
export const siteMetadata={
  title:'Kuriake Castle',
  description:'Kuriake Castle annual leadership commitment',
  icons:{icon:`${basePath}/assets/brand/castle-favicon.png`,apple:`${basePath}/assets/brand/castle-favicon.png`},
};
export const siteViewport={themeColor:'#0d242b'};
export default function Document({children,surface}){
  return <html lang="en"><body data-surface={surface}>
    {children}
    <noscript><p>Please enable JavaScript to use Kuriake Castle.</p></noscript>
  </body></html>;
}
