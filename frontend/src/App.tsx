import { Routes, Route } from 'react-router-dom';
import { Layout } from 'antd';
import { AgentsPage } from './pages/Agents';
import { TasksPage } from './pages/Tasks';
import { WorkflowsPage } from './pages/Workflows';
import { DashboardPage } from './pages/Dashboard';
import { Header } from './components/Header';
import { OrgPage } from './pages/Org';
import { GoalsPage } from './pages/Goals';
import { ApprovalsPage } from './pages/Approvals';
import { AuditPage } from './pages/Audit';
import { HeartbeatsPage } from './pages/Heartbeats';

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
          <Route path="/org" element={<OrgPage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/approvals" element={<ApprovalsPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/heartbeats" element={<HeartbeatsPage />} />
        </Routes>
      </Content>
    </Layout>
  );
}

export default App;