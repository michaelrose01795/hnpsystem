// file location: src/components/page-ui/newsfeed-ui.js

export default function NewsFeedUi(props) {
  const {
    AVAILABLE_DEPARTMENTS,
    ModalPortal,
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
            <button onClick={() => {
        resetModal();
        setModalOpen(true);
      }} className="px-5 py-2 font-semibold text-white rounded-xl  transition-all hover:-translate-y-0.5 hover:shadow-lg" style={{
        backgroundColor: "var(--primary)",
        border: "1px solid var(--primary-selected)"
      }} type="button">
              Add Update
            </button>
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

        {!loading && accessibleUpdates.length === 0 && <div className="text-center py-16" style={{
      border: "none",
      borderRadius: "var(--radius-md)",
      backgroundColor: "var(--surface)"
    }}>
            <p className="text-sm" style={{
        color: "var(--text-1)",
        opacity: 0.7
      }}>
              No updates published for your departments yet.
            </p>
          </div>}

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

      {modalOpen && <ModalPortal>
          <div className="popup-backdrop" onClick={e => {
      if (e.target === e.currentTarget) {
        setModalOpen(false);
        resetModal();
      }
    }}>
            <div className="popup-card" role="dialog" aria-modal="true" style={{
        borderRadius: "var(--radius-xl)",
        width: "100%",
        maxWidth: "650px",
        maxHeight: "90vh",
        overflowY: "auto",
        border: "none"
      }} onClick={e => e.stopPropagation()}>
            {/* Content */}
            <div style={{
          padding: "32px"
        }}>
              {/* Heading row with Departments dropdown */}
              <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            marginBottom: "24px"
          }}>
                <h3 style={{
              margin: 0,
              fontSize: "28px",
              fontWeight: "bold",
              color: "var(--primary)"
            }}>
                  Share an Update
                </h3>
                <div style={{
              display: "flex",
              justifyContent: "flex-start",
              minWidth: "260px"
            }}>
                  <MultiSelectDropdown searchPlaceholder="Visible to Departments" placeholder="Visible to Departments" options={AVAILABLE_DEPARTMENTS} value={formState.departments} onChange={selectedDepartments => {
                setFormState(prev => ({
                  ...prev,
                  departments: selectedDepartments
                }));
              }} emptyState="No departments available" />
                </div>
              </div>

              {/* Title Field */}
              <div style={{
            marginBottom: "24px"
          }}>
                <label style={{
              display: "block",
              marginBottom: "8px",
              fontSize: "14px",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--primary)"
            }} htmlFor="news-title">
                  Title
                </label>
                <input id="news-title" type="text" placeholder="Enter update title..." value={formState.title} onChange={event => setFormState(previous => ({
              ...previous,
              title: event.target.value
            }))} style={{
              width: "100%",
              padding: "12px 16px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              backgroundColor: "var(--theme)",
              fontSize: "15px"
            }} />
              </div>

              {/* Description Field */}
              <div style={{
            marginBottom: "24px"
          }}>
                <label style={{
              display: "block",
              marginBottom: "8px",
              fontSize: "14px",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--primary)"
            }} htmlFor="news-content">
                  Description
                </label>
                <textarea id="news-content" rows={5} placeholder="Write your update details..." value={formState.content} onChange={event => setFormState(previous => ({
              ...previous,
              content: event.target.value
            }))} style={{
              width: "100%",
              padding: "12px 16px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              backgroundColor: "var(--theme)",
              fontSize: "15px",
              resize: "none"
            }} />
              </div>

              {/* Error Message */}
              {notificationError && <div style={{
            padding: "12px 16px",
            borderRadius: "var(--radius-sm)",
            border: "none",
            backgroundColor: "var(--danger-surface)",
            color: "var(--danger)",
            fontSize: "13px",
            fontWeight: "600"
          }}>
                  {notificationError}
                </div>}
            </div>

            {/* Footer Actions */}
            <div style={{
          padding: "24px 32px",
          borderTop: "1px solid var(--surface)",
          display: "flex",
          justifyContent: "flex-end",
          gap: "12px"
        }}>
              <button type="button" onClick={() => {
            setModalOpen(false);
            resetModal();
          }} style={{
            padding: "12px 24px",
            borderRadius: "var(--radius-sm)",
            border: "2px solid var(--surface)",
            backgroundColor: "transparent",
            fontSize: "15px",
            fontWeight: "bold",
            color: "var(--text-1)",
            cursor: "pointer",
            transition: "all 0.2s"
          }} onMouseEnter={e => {
            e.currentTarget.style.borderColor = "var(--primary)";
            e.currentTarget.style.backgroundColor = "var(--surface)";
          }} onMouseLeave={e => {
            e.currentTarget.style.borderColor = "var(--surface)";
            e.currentTarget.style.backgroundColor = "transparent";
          }}>
                Cancel
              </button>
              <button type="button" onClick={handleCreateUpdate} disabled={saving} style={{
            padding: "12px 24px",
            borderRadius: "var(--radius-sm)",
            border: "2px solid var(--primary-selected)",
            backgroundColor: "var(--primary)",
            color: "white",
            fontSize: "15px",
            fontWeight: "bold",
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.6 : 1,
            transition: "all 0.2s",
            boxShadow: "none"
          }} onMouseEnter={e => {
            if (!saving) {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 6px 16px rgba(0, 0, 0, 0.2)";
              e.currentTarget.style.zIndex = "var(--hover-surface-z, 80)";
            }
          }} onMouseLeave={e => {
            if (!saving) {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";
              e.currentTarget.style.zIndex = "0";
            }
          }}>
                {saving ? "Publishing…" : "Publish Update"}
              </button>
            </div>
            </div>
          </div>
        </ModalPortal>}
    </>; // render extracted page section.
    default:
      return null; // keep unknown sections visually empty.
  }
}
