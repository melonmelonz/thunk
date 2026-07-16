//! The placement diagnostic: answer a module's items correctly and you have
//! shown you do not need the module. Nobody is held back; nobody is bored.

use crate::check::{Answer, Check, Verdict};
use crate::content::ModuleId;

/// One diagnostic question, tagged with the module it stands in for.
#[derive(Clone, Debug)]
pub struct PlacementItem {
    pub module: ModuleId,
    pub check: Check,
}

/// Which modules did these answers place out of? A module places only when
/// every one of its items was answered, and answered correctly. Answers pair
/// with items by position; missing answers fail their items.
pub fn evaluate_placement(items: &[PlacementItem], answers: &[Answer]) -> Vec<ModuleId> {
    let mut order: Vec<ModuleId> = Vec::new();
    let mut all_correct: std::collections::BTreeMap<ModuleId, bool> = Default::default();
    for (i, item) in items.iter().enumerate() {
        let correct = answers
            .get(i)
            .map(|a| item.check.grade(a) == Verdict::Correct)
            .unwrap_or(false);
        if !all_correct.contains_key(&item.module) {
            order.push(item.module.clone());
        }
        let entry = all_correct.entry(item.module.clone()).or_insert(true);
        *entry = *entry && correct;
    }
    order.into_iter().filter(|m| all_correct[m]).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::check::{Answer, Check, CheckId};
    use crate::content::ModuleId;

    fn item(module: &str, check_id: &str, answer: usize) -> PlacementItem {
        PlacementItem {
            module: ModuleId(module.into()),
            check: Check::Choice {
                id: CheckId(check_id.into()),
                prompt: "p".into(),
                options: vec!["x".into(), "y".into()],
                answer,
            },
        }
    }

    #[test]
    fn a_module_places_only_when_all_its_items_are_correct() {
        let items = vec![
            item("m1", "q1", 0),
            item("m1", "q2", 1),
            item("m2", "q3", 0),
        ];
        let answers = vec![Answer::Choice(0), Answer::Choice(1), Answer::Choice(1)];
        let placed = evaluate_placement(&items, &answers);
        assert_eq!(placed, vec![ModuleId("m1".into())]); // m2's one item was wrong
    }

    #[test]
    fn unanswered_items_do_not_place() {
        let items = vec![item("m1", "q1", 0), item("m1", "q2", 1)];
        let answers = vec![Answer::Choice(0)]; // second item never answered
        assert!(evaluate_placement(&items, &answers).is_empty());
    }

    #[test]
    fn extra_answers_past_the_items_are_ignored() {
        // Answers pair with items by position; trailing answers with no item
        // are surplus and change nothing (no panic, no phantom placement).
        let items = vec![item("m1", "q1", 0)];
        let answers = vec![Answer::Choice(0), Answer::Choice(1), Answer::Choice(0)];
        assert_eq!(
            evaluate_placement(&items, &answers),
            vec![ModuleId("m1".into())]
        );
    }

    #[test]
    fn empty_inputs_place_nothing() {
        assert!(evaluate_placement(&[], &[]).is_empty());
        // Items but zero answers: every item fails, nothing places.
        let items = vec![item("m1", "q1", 0), item("m2", "q2", 1)];
        assert!(evaluate_placement(&items, &[]).is_empty());
    }

    #[test]
    fn placed_modules_keep_first_appearance_order_not_answer_correctness() {
        // Two modules both fully correct, interleaved: the result preserves the
        // order each module's first item appears, independent of the BTreeMap.
        let items = vec![
            item("m2", "q1", 0),
            item("m1", "q2", 0),
            item("m2", "q3", 0),
            item("m1", "q4", 0),
        ];
        let answers = vec![
            Answer::Choice(0),
            Answer::Choice(0),
            Answer::Choice(0),
            Answer::Choice(0),
        ];
        assert_eq!(
            evaluate_placement(&items, &answers),
            vec![ModuleId("m2".into()), ModuleId("m1".into())]
        );
    }
}
