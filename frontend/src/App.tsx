import { Routes, Route } from 'react-router-dom';
import { Layout } from 'antd';
import { AgentsPage } from './pages/Agents';
import { TasksPage } from './pages/Tasks';
import { WorkflowsPage } from './pages/Workflows';
import { DashboardPage } from './pages/Dashboard';
import { GlobalStyles } from './styles';
import { Header } from './components/Header';

const { Content } = Layout;

function App() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header />
      <Content style={{ padding: '24px' }}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/workflows" element={<WorkflowsPage />} />
        </Routes>
      </Content>
    </Layout>
  );
}

export default App;