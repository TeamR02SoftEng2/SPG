import { Alert,Container,Row } from "react-bootstrap";
import { useState } from "react";
function ClientPage(props) {
  const [show, setShow] = useState(true);

return (<>
    <br/>
    <Container fluid="sx">
  <Row className="justify-content-md-center">

  {(props.clients.find(s=>(s.client_id===props.clientid&&s.budget===0)))?
  <>
  {show?
      <Alert style={{'backgroundColor':"#dc143c", 'width':"600px"}} onClose={() => setShow(false)} dismissible >
        <Alert.Heading data-testid="alertH"style={{'fontSize': 22, 'color':"white", 'text-align':"center"}}>-ATTENTION-</Alert.Heading>
        <p data-testid="alert" style={{'fontSize': 22, 'color':"white", 'text-align':"center"}}>
          Your wallet balance is insufficient. Please top it up!
        </p>
      </Alert>:<></>}</>:<></>}</Row></Container>
  </>  );
  }
 export default ClientPage;
