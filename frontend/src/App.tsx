import { ConfigProvider } from 'antd';
import { antdTheme } from '@/styles/antd-theme';
import { GlobalStyle } from '@/styles/global';
import { BrowserRouter } from 'react-router-dom';

function App() {
  return (
    <ConfigProvider theme={antdTheme}>
      <GlobalStyle />
      <BrowserRouter>
        {/* Routes will be added in R2 */}
        <div>Nexus - Loading...</div>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
