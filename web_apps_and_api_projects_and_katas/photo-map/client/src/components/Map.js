import React, { useState, useEffect, useContext } from "react";
import { withStyles } from "@material-ui/core/styles";
import useMediaQuery from "@material-ui/core/useMediaQuery";
import ReactMapGL, { NavigationControl, Marker, Popup } from "react-map-gl";
import { Subscription } from "react-apollo";
import {
  PIN_ADDED_SUBSCRIPTION,
  PIN_UPDATED_SUBSCRIPTION,
  PIN_DELETED_SUBSCRIPTION,
} from "../graphql/subscriptions";
import Blog from "./Blog";
import PinIcon from "./PinIcon";
import {
  CREATE_DRAFT,
  CREATE_PIN,
  SET_PIN,
  DELETE_PIN,
  GET_PINS,
  UPDATE_DRAFT_LOCATION,
  CREATE_COMMENT,
} from "../state/constants";
import { useClient } from "../client";
import {} from "../state/constants";
import { GET_PINS_QUERY } from "../graphql/queries";
import { DELETE_PIN_MUTATION } from "../graphql/mutations";
import differenceInMinutes from "date-fns/differenceInMinutes";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import DeleteIcon from "@material-ui/icons/DeleteTwoTone";
import Context from "../state/context";

const INITIAL_VIEWPORT = {
  latitude: 53.41654,
  longitude: -2.23679,
  zoom: 13,
};

const Map = ({ classes }) => {
  const client = useClient();
  const mobileSize = useMediaQuery("(max-width: 650px)");
  const { state, dispatch } = useContext(Context);
  const [viewport, setViewport] = useState(INITIAL_VIEWPORT);
  const [userPosition, setUserPosition] = useState(null);
  const [popup, setPopup] = useState(null);

  useEffect(() => {
    const pinExists =
      popup && state.pins.findIndex((pin) => pin._id === popup._id) > -1;
    if (pinExists) {
      setPopup(null);
    }
  }, [state.pins.length]); // eslint-disable-line

  useEffect(() => {
    getUserPosition();
  }, []); // eslint-disable-line

  useEffect(() => {
    getPins();
  }, []); // eslint-disable-line

  const getPins = async () => {
    const { getPins } = await client.request(GET_PINS_QUERY);
    dispatch({ type: GET_PINS, payload: getPins });
  };

  const handleSelectPin = (pin) => {
    setPopup(pin);
    dispatch({ type: SET_PIN, payload: pin });
  };

  const handleDeletePin = async (pin) => {
    const variables = { pinId: pin._id };
    await client.request(DELETE_PIN_MUTATION, variables);
    setPopup(null);
  };

  const handleMapChange = ({ lngLat, leftButton }) => {
    if (!leftButton) {
      return;
    }
    if (!state.draft) {
      dispatch({ type: CREATE_DRAFT });
    }
    const [longitude, latitude] = lngLat;
    dispatch({
      type: UPDATE_DRAFT_LOCATION,
      payload: { latitude, longitude },
    });
  };

  const getUserPosition = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        setViewport({ ...viewport, latitude, longitude });
        setUserPosition({ latitude, longitude });
      });
    }
  };

  const highlightNewPin = (pin) => {
    const isNewPin =
      differenceInMinutes(Date.now(), Number(pin.createdAt)) <= 30;
    return isNewPin ? "blue" : "darkblue";
  };

  const isAuthUser = () => {
    console.log(state);
    console.log(popup);
    return state.currentUser._id === popup.author._id;
  };

  return (
    <div className={mobileSize ? classes.rootMobile : classes.root}>
      <ReactMapGL
        width="100vw"
        height="calc(100vh - 64px)"
        mapStyle="mapbox://styles/mapbox/streets-v9"
        mapboxApiAccessToken="pk.eyJ1IjoibWF0dGxvbmdjb2RlMCIsImEiOiJja2lwM3NucWgwMzN4MnRwOW9jeGl4OXVtIn0.ykD1Qpr28QEm7Xcoqw75fg"
        scrollZoom={!mobileSize}
        onClick={handleMapChange}
        onViewportChange={(newViewport) => {
          setViewport(newViewport);
        }}
        {...viewport}
      >
        <div className={classes.navigationControl}>
          <NavigationControl
            onViewportChange={(newViewport) => {
              setViewport(newViewport);
            }}
          />
        </div>

        {userPosition && (
          <Marker
            latitude={userPosition.latitude}
            longitude={userPosition.longitude}
            offsetLeft={-19}
            offsetTop={-37}
          >
            <PinIcon size={40} color="red" />
          </Marker>
        )}

        {state.draft && (
          <Marker
            latitude={state.draft.latitude}
            longitude={state.draft.longitude}
            offsetLeft={-19}
            offsetTop={-37}
          >
            <PinIcon size={40} color="blue" />
          </Marker>
        )}

        {state.pins.map((pin) => (
          <Marker
            key={pin._id}
            latitude={pin.latitude}
            longitude={pin.longitude}
            offsetLeft={-19}
            offsetTop={-37}
          >
            <PinIcon
              onClick={(event) => {
                handleSelectPin(pin);
              }}
              size={40}
              color={highlightNewPin(pin)}
            />
          </Marker>
        ))}

        {popup && (
          <Popup
            anchor="top"
            latitude={popup.latitude}
            longitude={popup.longitude}
            closeOnClick={false}
            onClose={() => setPopup(null)}
          >
            <img
              className={classes.popupImage}
              src={popup.image}
              alt={popup.title}
            />
            <div className={classes.popupTab}>
              <Typography>
                {popup.latitude.toFixed(6)}, {popup.longitude.toFixed(6)}
              </Typography>
              {isAuthUser() && (
                <Button onClick={() => handleDeletePin(popup)}>
                  <DeleteIcon className={classes.deleteIcon} />
                </Button>
              )}
            </div>
          </Popup>
        )}
      </ReactMapGL>
      <Subscription
        subscription={PIN_ADDED_SUBSCRIPTION}
        onSubscriptionData={({ subscriptionData }) => {
          const { pinAdded } = subscriptionData.data;
          dispatch({ type: CREATE_PIN, payload: pinAdded });
        }}
      />
      <Subscription
        subscription={PIN_UPDATED_SUBSCRIPTION}
        onSubscriptionData={({ subscriptionData }) => {
          const { pinUpdated } = subscriptionData.data;
          dispatch({ type: CREATE_COMMENT, payload: pinUpdated });
        }}
      />
      <Subscription
        subscription={PIN_DELETED_SUBSCRIPTION}
        onSubscriptionData={({ subscriptionData }) => {
          const { pinDeleted } = subscriptionData.data;
          dispatch({ type: DELETE_PIN, payload: pinDeleted });
        }}
      />
      <Blog />
    </div>
  );
};

const styles = {
  root: {
    display: "flex",
  },
  rootMobile: {
    display: "flex",
    flexDirection: "column-reverse",
  },
  navigationControl: {
    position: "absolute",
    top: 0,
    left: 0,
    margin: "1em",
  },
  deleteIcon: {
    color: "red",
  },
  popupImage: {
    padding: "0.4em",
    height: 200,
    width: 200,
    objectFit: "cover",
  },
  popupTab: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
  },
};

export default withStyles(styles)(Map);
