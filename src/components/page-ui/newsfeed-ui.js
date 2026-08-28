// file location: src/components/page-ui/newsfeed-ui.js
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import PopupModal from "@/components/popups/popupStyleApi";

export default function NewsFeedUi(props) {
  const {
    AVAILABLE_DEPARTMENTS,
    MultiSelectDropdown,
    SkeletonBlock,
    SkeletonKeyframes,
    accessibleUpdates,
    canManageUpdates,
    formState,
    formatTimeAgo,
    handleCreateUpdate,
    loading,
    modalOpen,
    notificationError,
    resetModal,
    saving,
    setFormState,
    setModalOpen,
  } = props; // receive page logic props.

  switch (props.view) { // choose the page section requested by logic.
    case "section1":
      return <>
      <div style={{
    width: "100%",
    maxWidth: "100%",
    padding: "8px 0"
  }}>
        {canManageUpdates && <div className="flex justify-end items-center" style={{
      width: "100%",
      paddingBottom: "16px"
    }}>
            <Button type="button" variant="primary" onClick={() => {
        resetModal();
        setModalOpen(true);
      }}>
              Add Update
            </Button>
          </div>}

        {loading && <div className="mb-6" style={{
      display: "flex",
      flexDirection: "column",
      gap: 14
    }}>
            <SkeletonKeyframes />
            {Array.from({
        length: 3
      }).map((_, i) => <div key={i} style={{
        background: "var(--surface)",
        borderRadius: "var(--radius-md)",
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 10
      }}>
                <div style={{
          display: "flex",
          gap: 10,
          alignItems: "center"
        }}>
                  <SkeletonBlock width="38px" height="38px" borderRadius="999px" />
                  <SkeletonBlock width="160px" height="14px" />
                </div>
                <SkeletonBlock width="80%" height="18px" />
                <SkeletonBlock width="100%" height="12px" />
                <SkeletonBlock width="90%" height="12px" />
              </div>)}
          </div>}

        {!loading && accessibleUpdates.length === 0 && (
          <EmptyState
            icon="📣"
            title="No updates yet"
            description="No updates have been published for your departments yet. New announcements will appear here."
          />
        )}

        <div style={{
      display: "flex",
      flexDirection: "column",
      gap: "20px"
    }}>
          {accessibleUpdates.map(update => <article key={update.id ?? update.title} style={{
        padding: "20px 24px",
        border: "none",
        borderRadius: "var(--radius-sm)",
        backgroundColor: "var(--theme)",
        cursor: "pointer",
        transition: "transform 0.3s ease, box-shadow 0.3s ease",
        maxWidth: "100%",
        width: "100%"
      }} onMouseEnter={e => {
        e.currentTarget.style.position = "relative";
        e.currentTarget.style.zIndex = "var(--hover-surface-z, 80)";
        e.currentTarget.style.transform = "translateY(-8px)";
        e.currentTarget.style.boxShadow = "0 8px 16px rgba(0, 0, 0, 0.1)";
      }} onMouseLeave={e => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.zIndex = "0";
      }}>
              {/* Title */}
              <h2 style={{
          fontSize: "22px",
          fontWeight: "bold",
          marginBottom: "8px",
          color: "var(--text-1)"
        }}>
                {update.title}
              </h2>

              {/* Author and Time */}
              <div style={{
          fontSize: "11px",
          marginBottom: "12px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          color: "var(--text-1)",
          opacity: 0.7
        }}>
                <span>{update.author || "System"}</span>
                <span>•</span>
                <span>{formatTimeAgo(update.created_at)}</span>
              </div>

              {/* Description */}
              <div style={{
          fontSize: "15px",
          lineHeight: "1.6",
          color: "var(--text-1)",
          opacity: 0.9,
          maxHeight: "calc(1.6em * 20)",
          overflowY: "auto"
        }}>
                {update.content}
              </div>
            </article>)}
        </div>
      </div>

      <PopupModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetModal();
        }}
        closeOnBackdrop={!saving}
        ariaLabel="Share an update"
        cardStyle={{
          width: "min(100%, 650px)",
          padding: "var(--page-card-padding)"
        }}
      >
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--layout-card-gap)"
        }}>
          <header className="app-popup-compact-header">
            <h3>Share an Update</h3>
            <div className="app-popup-compact-header__actions">
              <Button
                type="button"
                variant="primary"
                size="sm"
                busy={saving}
                onClick={handleCreateUpdate}
              >
                {saving ? "Publishing…" : "Publish Update"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setModalOpen(false);
                  resetModal();
                }}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </header>

          <div>
            <label htmlFor="news-title">Title</label>
            <input
              className="app-input"
              id="news-title"
              type="text"
              placeholder="Enter update title..."
              value={formState.title}
              onChange={event => setFormState(previous => ({
                ...previous,
                title: event.target.value
              }))}
            />
          </div>

          <div>
            <label htmlFor="news-content">Description</label>
            <textarea
              className="app-input"
              id="news-content"
              rows={5}
              placeholder="Write your update details..."
              value={formState.content}
              onChange={event => setFormState(previous => ({
                ...previous,
                content: event.target.value
              }))}
            />
          </div>

          <MultiSelectDropdown
            id="news-departments"
            label="Visible to departments"
            searchPlaceholder="Search departments"
            placeholder="Select departments"
            options={AVAILABLE_DEPARTMENTS}
            value={formState.departments}
            onChange={selectedDepartments => {
              setFormState(prev => ({
                ...prev,
                departments: selectedDepartments
              }));
            }}
            emptyState="No departments available"
            usePortal
          />

          {notificationError && (
            <div className="app-status-message app-status-message--danger" role="alert">
              {notificationError}
            </div>
          )}
        </div>
      </PopupModal>
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
