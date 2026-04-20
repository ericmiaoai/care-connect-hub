import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import MyDay from './pages/MyDay';
import Calendar from './pages/Calendar';
import Updates from './pages/Updates';
import ScanAVS from './pages/ScanAVS';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<MyDay />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="updates" element={<Updates />} />
          <Route path="scan" element={<ScanAVS />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
