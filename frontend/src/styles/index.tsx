import { GlobalStyle } from 'antd';

export const GlobalStyles = GlobalStyle`
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
                 'Helvetica Neue', Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  .react-flow__node {
    background: white;
    border: 1px solid #d9d9d9;
    border-radius: 6px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .react-flow__node-running {
    background: #e6f7ff;
    border-color: #1890ff;
  }

  .react-flow__node-completed {
    background: #f6ffed;
    border-color: #52c41a;
  }

  .react-flow__node-failed {
    background: #fff1f0;
    border-color: #ff4d4f;
  }

  .status-badge {
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
  }

  .status-online {
    background: #f6ffed;
    color: #52c41a;
    border: 1px solid #b7eb8f;
  }

  .status-offline {
    background: #f5f5f5;
    color: #8c8c8c;
    border: 1px solid #d9d9d9;
  }

  .status-busy {
    background: #e6f7ff;
    color: #1890ff;
    border: 1px solid #91caff;
  }
`;