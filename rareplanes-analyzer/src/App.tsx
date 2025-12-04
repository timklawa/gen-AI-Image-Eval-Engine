import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ImageGrid from './components/ImageGrid';
import ImageDetail from './components/ImageDetail';
import Ontology from './components/Ontology';
import Eval from './components/Eval';

function App() {
  return (
    <Router>
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<ImageGrid />} />
            <Route path="/image/:subset/:imageId" element={<ImageDetail />} />
            <Route path="/ontology" element={<Ontology />} />
            <Route path="/eval" element={<Eval />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
