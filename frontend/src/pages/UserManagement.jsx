import React, { useState, useEffect } from 'react';
import styles from './UserManagement.module.css';
import UserService from '../services/UserService';
import AddUserModal from '../components/AddUserModal';
import EditUserModal from '../components/EditUserModal';
import Side from "./sidebar/Sidebar";
import ProfileAvatar from "../components/ProfileAvatar";
import belldot from "../assets/dashboard/bell-dot.svg";
import chevrondown from "../assets/dashboard/chevron-down.svg";
import chevrondright from "../assets/dashboard/chevron-right.svg";
import NotificationBell from "../components/NotificationBell";
import DeleteModal from '../components/delete-modal/DeleteModal';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false); // New state for Edit Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [userToEdit, setUserToEdit] = useState(null); // New state for User to Edit
  const [username, setUsername] = useState("");

   useEffect(() => {
      setUsername(localStorage.getItem("username") || "");
    }, []);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const usersData = await UserService.getAllUsers();
      setUsers(usersData);
      setError(null);
    } catch (err) {
      setError('Failed to fetch users');
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (userData) => {
    try {
      await UserService.createUser(userData);
      await fetchUsers(); // Refresh the list
      setIsAddUserModalOpen(false);
    } catch (err) {
      console.error('Error creating user:', err);
      throw err; // Re-throw to let the modal handle the error
    }
  };

  const handleEditUser = async (userId, userData) => {
    try {
      await UserService.updateUser(userId, userData);
      await fetchUsers();
      setIsEditUserModalOpen(false);
      setUserToEdit(null);
      alert("User updated successfully!");
    } catch (err) {
      console.error('Error updating user:', err);
      throw err;
    }
  };

  const openEditModal = (user) => {
    setUserToEdit(user);
    setIsEditUserModalOpen(true);
  };

  // Open delete confirmation modal
  const handleDeleteUserClick = (user) => {
    setUserToDelete(user);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    try {
      await UserService.deleteUser(userToDelete._id);
      await fetchUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
      alert(err?.message || 'Failed to delete user');
    } finally {
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setIsDeleteModalOpen(false);
    setUserToDelete(null);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading users...</div>
      </div>
    );
  }

  return (
     <div className={styles["dashboard-layout"]}>
          <div className={styles["desktop-sidebar"]}>
        <Side />
      </div>
      <main>
        <header className={styles["dashboard-header"]}>
          <div className={styles["dashboard-row"]}>
            <div className={styles["dashboard-title"]}>User</div>

            <div className={styles["dashboard-profile"]}>
              <NotificationBell />

               <div className={styles["profile-info"]}>
                 <div className={styles["profile-row"]}>
                   <ProfileAvatar size={40} className={styles["profile-picture"]} />
                   <div className={styles["profile-column"]}>
                     <div className={styles["profile-name"]}>
                       {username?.toUpperCase()}
                     </div>
                     <div className={styles["profile-type"]}>Administrator</div>
                   </div>
                 </div>
                 {/* <img src={chevrondown} alt="" /> */}
               </div>
             </div>
           </div>
         </header>

        <section className={styles["breadcrumb-section"]}>
          <div className={styles["breadcrumb"]}>
            <div className={styles["breadcrumb-one"]}>Home</div>
            <img src={chevrondright} alt="" />
            <div className={styles["breadcrumb-two"]}>UserManagement</div>
          </div>
        </section>
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>User Management</h1>
        <button 
          className={styles.addButton}
          onClick={() => setIsAddUserModalOpen(true)}
        >
          Add New User
        </button>
      </div>

      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Phone Number</th>
              <th>Role</th>
              <th>Created At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan="6" className={styles.noData}>
                  No users found
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user._id}>
                  <td>{user.username}</td>
                  <td>{user.emailId || '-'}</td>
                  <td>{user.phoneNumber || '-'}</td>
                  <td>
                    <span className={`${styles.roleBadge} ${styles[user.role]}`}>
                      {user.role}
                    </span>
                  </td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>
                    <button 
                      className={styles.editButton}
                      onClick={() => openEditModal(user)}
                      
                    >
                      Edit
                    </button>
                    <button 
                      className={styles.deleteButton}
                      onClick={() => handleDeleteUserClick(user)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Delete confirmation modal */}
      <DeleteModal
        isOpen={isDeleteModalOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title={userToDelete ? `Delete ${userToDelete.username}?` : 'Delete user?'}
        description={userToDelete ? `Are you sure you want to delete ${userToDelete.username}? This action cannot be undone.` : 'Are you sure you want to delete this user?'}
      />

      <AddUserModal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        onSubmit={handleAddUser}
      />

      <EditUserModal
        isOpen={isEditUserModalOpen}
        onClose={() => setIsEditUserModalOpen(false)}
        onSubmit={handleEditUser}
        userToEdit={userToEdit}
      />
    </div>
      
      </main>
    </div>
  );
};

export default UserManagement;
