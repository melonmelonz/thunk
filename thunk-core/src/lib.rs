//! thunk domain logic. Pure, offline, no I/O beyond what callers pass in.

pub mod check;
pub mod content;
pub mod gate;
pub mod placement;
pub mod progress;
pub mod state;

pub use check::{Answer, Check, CheckId, Verdict};
pub use content::{Lesson, LessonId, Module, ModuleId};
pub use gate::{ladder_state, ModuleStatus};
pub use placement::{evaluate_placement, PlacementItem};
pub use progress::Progress;
pub use state::{progress_from_ron, progress_to_ron, state_path};
