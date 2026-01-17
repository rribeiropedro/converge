import { useState, useEffect } from 'react';
import { getUsers, createUser, deleteUser } from './services/api';
import './App.css';

function App() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newUser, setNewUser] = useState({ name: '', email: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch users on mount
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await getUsers();
      setUsers(data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch users. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newUser.name || !newUser.email) return;

    try {
      setIsSubmitting(true);
      await createUser(newUser);
      setNewUser({ name: '', email: '' });
      await fetchUsers();
    } catch (err) {
      setError(err.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteUser(id);
      await fetchUsers();
    } catch (err) {
      setError('Failed to delete user');
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Converge</h1>
        <p className="subtitle">React + Express + MongoDB</p>
      </header>

      <main className="main">
        <section className="card">
          <h2>Add New User</h2>
          <form onSubmit={handleSubmit} className="form">
            <input
              type="text"
              placeholder="Name"
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              className="input"
            />
            <input
              type="email"
              placeholder="Email"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              className="input"
            />
            <button type="submit" className="btn" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add User'}
            </button>
          </form>
        </section>

        <section className="card">
          <h2>Users</h2>
          {error && <p className="error">{error}</p>}
          {loading ? (
            <p className="loading">Loading...</p>
          ) : users.length === 0 ? (
            <p className="empty">No users found. Add one above!</p>
          ) : (
            <ul className="user-list">
              {users.map((user) => (
                <li key={user._id} className="user-item">
                  <div className="user-info">
                    <span className="user-name">{user.name}</span>
                    <span className="user-email">{user.email}</span>
                  </div>
                  <button
                    onClick={() => handleDelete(user._id)}
                    className="btn btn-danger"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card status-card">
          <h2>Connection Status</h2>
          <div className="status">
            <div className="status-item">
              <span className="status-label">Frontend:</span>
              <span className="status-value online">✓ Running</span>
            </div>
            <div className="status-item">
              <span className="status-label">Backend:</span>
              <span className={`status-value ${error ? 'offline' : 'online'}`}>
                {error ? '✗ Disconnected' : '✓ Connected'}
              </span>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>Full Stack Boilerplate • Ready to build</p>
      </footer>
    </div>
  );
}

export default App;

