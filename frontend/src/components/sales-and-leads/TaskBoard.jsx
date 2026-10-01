import React, { useEffect, useMemo, useState } from "react";
import styles from "./TaskBoard.module.css";
import { getTasksByClient, updateTask, deleteTask } from "../../services/TaskService";
import { useParams } from "react-router-dom";

import plus from "../../assets/dashboard/plus.svg";
import add_circle_outline from "../../assets/dashboard/add_circle_outline.svg";
import trashred from "../../assets/dashboard/trash-red.svg";
import more_horiz from "../../assets/dashboard/more_horiz.svg";
import pencilline from "../../assets/dashboard/pencil-line.svg";
import EditTaskModal from "./EditTaskModal";
import DeleteModal from "../delete-modal/DeleteModal";

const TaskBoard = ({ onRefresh }) => {
  const { id: clientId } = useParams();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const data = await getTasksByClient(clientId);
      setTasks(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to load tasks", e);
      setError("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clientId) loadTasks();
  }, [clientId]);

  // Expose refresh method to parent
  useEffect(() => {
    if (onRefresh) {
      onRefresh.current = loadTasks;
    }
  }, [onRefresh, loadTasks]);

  const columnsFromTasks = useMemo(() => {
    const groups = {
      backlog: [],
      todo: [],
      inprogress: [],
      done: [],
    };
    for (const t of tasks) {
      const key = t.status || "todo";
      groups[key] = groups[key] || [];
      groups[key].push({
        id: t._id,
        date: new Date(t.date).toLocaleDateString("en-GB"),
        title: t.title,
        priority: `Priority:${t.priority || "Medium"}`,
        avatars: plus,
        fullTask: t, // Store the full task object for editing
      });
    }
    return [
      {
        id: "backlog",
        title: "Backlog Tasks",
        countColor: "yellow",
        tasks: groups.backlog,
      },
      {
        id: "todo",
        title: "To Do Tasks",
        countColor: "pink",
        tasks: groups.todo,
      },
      {
        id: "inprogress",
        title: "In Progress",
        countColor: "purple",
        tasks: groups.inprogress,
      },
      { id: "done", title: "Done", countColor: "green", tasks: groups.done },
    ].map((col) => ({ ...col, count: col.tasks.length }));
  }, [tasks]);

  const handleDragStart = (e, taskId, sourceColumnId) => {
    if (!taskId || !sourceColumnId) {
      e.preventDefault();
      return;
    }

    try {
      e.dataTransfer.setData(
        "text/plain",
        JSON.stringify({ taskId, sourceColumnId })
      );
      e.dataTransfer.effectAllowed = "move";
    } catch (error) {
      console.error("Error during drag start:", error);
      e.preventDefault();
    }
  };

  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(columnId);
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverColumn(null);
    }
  };

  const handleEditTask = (task) => {
    // Pass the full task object from the backend
    setSelectedTask(task.fullTask);
    setIsEditModalOpen(true);
  };

  const handleDeleteTask = (task) => {
    // Open delete modal and store task to delete
    setTaskToDelete(task);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;

    try {
      // Optimistic UI update - remove task immediately
      setTasks((prev) => prev.filter((t) => t._id !== taskToDelete.id));

      // Delete from backend
      await deleteTask(clientId, taskToDelete.id);
      
      console.log("Task deleted successfully");
      
      // Close modal and clear state
      setIsDeleteModalOpen(false);
      setTaskToDelete(null);
    } catch (error) {
      console.error("Error deleting task:", error);
      alert("Failed to delete task. Please try again.");
      
      // Refresh tasks on error to restore correct state
      try {
        const fetchedTasks = await getTasksByClient(clientId);
        setTasks(fetchedTasks);
      } catch (refreshError) {
        console.error("Error refreshing tasks:", refreshError);
      }
      
      // Close modal and clear state
      setIsDeleteModalOpen(false);
      setTaskToDelete(null);
    }
  };

  const handleTaskUpdated = async (updatedTask) => {
    try {
      const fetchedTasks = await getTasksByClient(clientId);
      setTasks(fetchedTasks);
      setIsEditModalOpen(false);
      setSelectedTask(null);
    } catch (error) {
      console.error("Error refreshing tasks:", error);
    }
  };

  const handleDrop = async (e, targetColumnId) => {
    e.preventDefault();
    setDragOverColumn(null);

    try {
      const dragData = e.dataTransfer.getData("text/plain");
      if (!dragData) return;

      const data = JSON.parse(dragData);
      const { taskId, sourceColumnId } = data;

      if (!taskId || !sourceColumnId || sourceColumnId === targetColumnId) {
        return;
      }

      // Optimistic UI: update local tasks state
      setTasks((prev) =>
        prev.map((t) =>
          t._id === taskId ? { ...t, status: targetColumnId } : t
        )
      );

      // Persist status change
      try {
        await updateTask(clientId, taskId, { status: targetColumnId });
      } catch (err) {
        console.error("Failed to update task status", err);
      }
    } catch (error) {
      console.error("Error during drag and drop:", error);
    }
  };

  const TaskCard = ({ task, isMinimal = false, columnId }) => {
    if (isMinimal) {
      return (
        <div
          className={styles.cardMinimal}
          draggable
          onDragStart={(e) => handleDragStart(e, task.id, columnId)}
        >
          <div className={styles.taskDate}>{task.date}</div>
          <div className={styles.taskTitle}>{task.title}</div>
        </div>
      );
    }

    return (
      <div
        className={styles.taskCard}
        draggable
        onDragStart={(e) => handleDragStart(e, task.id, columnId)}
      >
        <div className={styles.taskDate}>{task.date}</div>
        <div className={styles.taskHeader}>
          <div className={styles.taskTitle}>{task.title}</div>
        </div>
        <div className={styles.taskTags}>
          <div className={styles.priorityBadge}>
            <div className={styles.badgeText}>{task.priority}</div>
          </div>
        </div>
        <div className={styles.taskFooter}>
          <div className={styles.avatarGroup}>
            <img
              src={task.avatars}
              alt="avatars"
              className={styles.avatarImage}
            />
            <div className={styles.addButton}>
              <img
                src={add_circle_outline}
                alt="Add"
                className={styles.addIcon}
              />
            </div>
          </div>
          <div className={styles.actionIcons}>
            <img
              src={pencilline}
              alt="edit"
              role="button"
              tabIndex={0}
              className={`${styles.actionIcon} clickable`}
              onClick={() => handleEditTask(task)}
              style={{ cursor: "pointer" }}
            />
            <img 
              src={trashred} 
              alt="delete" 
              role="button"
              tabIndex={0}
              className={`${styles.actionIcon} clickable`}
              onClick={() => handleDeleteTask(task)}
              style={{ cursor: "pointer" }}
            />
          </div>
        </div>
      </div>
    );
  };

  const Column = ({ column }) => {
    const isDragOver = dragOverColumn === column.id;

    return (
      <div
        className={`${styles.column} ${isDragOver ? styles.dragOver : ""}`}
        onDragOver={(e) => handleDragOver(e, column.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, column.id)}
      >
        <div className={styles.columnHeader}>
          <div className={styles.columnLeft}>
            <div className={styles.columnTitle}>{column.title}</div>
            <div
              className={`${styles.counter} ${
                styles[
                  `counter${
                    column.countColor.charAt(0).toUpperCase() +
                    column.countColor.slice(1)
                  }`
                ]
              }`}
            >
              <div className={styles.badgeNumber}>{column.count}</div>
            </div>
          </div>
          <img
            src={more_horiz}
            alt="More options"
            className={styles.moreIcon}
          />
        </div>
        <div className={styles.columnContent}>
          {column.tasks.map((task, index) => (
            <TaskCard
              key={task.id}
              task={task}
              columnId={column.id}
              isMinimal={
                index === column.tasks.length - 1 && column.tasks.length > 3
              }
            />
          ))}
        </div>
        {(column.id === "todo" || column.id === "inprogress") && (
          <div className={styles.addColumnButton}>
            <img
              src={add_circle_outline}
              alt="Add"
              className={styles.addColumnIcon}
            />
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <div className={styles.taskBoard}>Loading tasks...</div>;
  }
  if (error) {
    return <div className={styles.taskBoard}>{error}</div>;
  }

  return (
    <div className={styles.taskBoard}>
      <div className={styles.boardContainer}>
        {columnsFromTasks.map((column) => (
          <Column key={column.id} column={column} />
        ))}
        <div className={styles.addNewColumn}>
          <div className={styles.addColumnHeader}>
            <div className={styles.addColumnText}>Add new Column</div>
          </div>
        </div>
      </div>

      <EditTaskModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedTask(null);
        }}
        clientId={clientId}
        task={selectedTask}
        onTaskUpdated={handleTaskUpdated}
      />

      <DeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setTaskToDelete(null);
        }}
        onConfirm={confirmDeleteTask}
        title="Delete this Task?"
        description={`Are you sure you want to delete "${taskToDelete?.title}"? This action cannot be undone.`}
      />
    </div>
  );
};

export default TaskBoard;